import moment, { unitOfTime } from "moment";

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { sleep } from "./helpers";

/**
 * Service Documentation
 * Service ID: hookup.to/service/timer
 * Service Name: Timer
 * Modes: periodic | oneShot
 * Key Config: periodic, periodicValue, periodicUnit, oneShotDelay, oneShotDelayUnit, tempoSlot, running, start, stop, restart, immediate, until.triggerCount
 * Input: any payload (used in delayed one-shot process path)
 * Output: tick payload with triggerCount and optional pass-through fields
 * Arrays: treated as generic input payloads
 * Binary: pass-through in delayed processing mode
 * MixedData: not native in browser runtime
 *
 * Unit "beats" (periodicUnit or oneShotDelayUnit) measures a duration in beats
 * of a tempo read from the slot named by tempoSlot (default "tempo"), in BPM.
 * The slot is read each time a duration is needed, so a tempo written while
 * the timer runs applies from its next wait or tick. No tempo held: 120 BPM.
 */

const serviceId = "hookup.to/service/timer";
const serviceName = "Timer";

const IMMEDIATE_DELAY = 1;
const DEFAULT_TEMPO_BPM = 120;

class Timer {
  uuid: string;
  board: string;
  app: AppInstance;

  __timer: ReturnType<typeof setInterval> | undefined;
  // A periodic timer counting in beats schedules one tick at a time, so that
  // each interval is measured at the tempo held when it begins.
  __beatTimer: ReturnType<typeof setTimeout> | undefined;
  counter: number;
  periodic: boolean;
  periodicValue: number;
  periodicUnit: string;
  oneShotDelay: number;
  oneShotDelayUnit: string;
  tempoSlot: string;
  running: boolean;
  conditionUntilTriggercount: number | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.__timer = undefined;
    this.counter = 0;
    this.periodic = false;
    this.periodicValue = 1;
    this.periodicUnit = "s";
    this.oneShotDelay = 0;
    this.oneShotDelayUnit = "ms";
    this.tempoSlot = "tempo";
    this.running = false;
  }

  hasSchedule(): boolean {
    return !!this.__timer || !!this.__beatTimer;
  }

  cancelSchedule(): void {
    if (this.__timer) {
      clearInterval(this.__timer);
      this.__timer = undefined;
    }
    if (this.__beatTimer) {
      clearTimeout(this.__beatTimer);
      this.__beatTimer = undefined;
    }
  }

  /** Beats per minute held in the tempo slot, or the default where none is. */
  tempo(): number {
    const held = Number(this.app.slots?.()?.get(this.tempoSlot));
    return Number.isFinite(held) && held > 0 ? held : DEFAULT_TEMPO_BPM;
  }

  /** A duration in milliseconds. */
  toMs(value: number, unit: string): number {
    switch (unit) {
      case "ms":
        return value;
      case "s":
        return value * 1000;
      case "beats":
        return (value * 60000) / this.tempo();
      default:
        return moment
          .duration(value, unit as unitOfTime.DurationConstructor)
          .asMilliseconds();
    }
  }

  clearTimer(): void {
    if (this.hasSchedule()) {
      this.cancelSchedule();
      this.counter = 0;
      this.running = false;
      this.app.notify(this, { running: false, count: this.counter });
    }
  }

  getConfiguration = async () => {
    return {
      periodic: this.periodic,
      periodicValue: this.periodicValue,
      periodicUnit: this.periodicUnit,
      oneShotDelay: this.oneShotDelay,
      oneShotDelayUnit: this.oneShotDelayUnit,
      tempoSlot: this.tempoSlot,
      running: this.running,
      counter: this.counter,
      bypass: (this as any).bypass === true,
    };
  };

  configure(config: any): void {
    const {
      bypass,
      periodicValue,
      periodicUnit,
      periodic,
      oneShotDelay,
      oneShotDelayUnit,
      tempoSlot,
      immediate,
      counter,
      running,
      until,
      // commands
      stop,
      start,
      restart,
    } = config;

    const isBypassed = bypass === true || (this as any).bypass === true;
    if (isBypassed) {
      this.clearTimer();
      return;
    }

    let doStop =
      stop || restart || (this.running && running !== undefined && !running);
    let doStart = start || restart;

    const silentRestartWhileRunning = () => {
      // silently clearing timer
      this.cancelSchedule();
      doStart = true;
    };

    if (periodicValue !== undefined) {
      this.periodicValue = periodicValue;
      this.app.notify(this, { periodicValue });
      if (doStart === undefined && running) {
        doStart = true;
      } else if (this.running) {
        silentRestartWhileRunning();
      }
    }

    if (periodicUnit !== undefined) {
      this.periodicUnit = periodicUnit;
      this.app.notify(this, { periodicUnit });
      if (doStart === undefined && running) {
        doStart = true;
      } else if (this.running) {
        silentRestartWhileRunning();
      }
    }

    if (periodic !== undefined) {
      this.periodic = periodic;
      this.app.notify(this, { periodic });
      if (doStart === undefined && running) {
        doStart = true;
      }
    }

    if (oneShotDelay !== undefined) {
      this.oneShotDelay = oneShotDelay;
      this.app.notify(this, { oneShotDelay, periodic: false });
    }

    if (counter !== undefined) {
      this.counter = counter;
    }

    if (until !== undefined) {
      const { triggerCount } = until;
      this.conditionUntilTriggercount = Number(triggerCount);
    }

    if (oneShotDelayUnit !== undefined) {
      this.oneShotDelayUnit = oneShotDelayUnit;
      this.app.notify(this, { oneShotDelayUnit });
    }

    if (typeof tempoSlot === "string" && tempoSlot) {
      this.tempoSlot = tempoSlot;
      this.app.notify(this, { tempoSlot });
    }

    const process = () => {
      if (
        this.conditionUntilTriggercount &&
        this.counter >= this.conditionUntilTriggercount
      ) {
        this.clearTimer();
      } else {
        const result = this.nextTimerArgument();
        const params = { counter: result.triggerCount };
        this.app.notify(this, params);
        this.app.next(this, result);
      }
    };

    if (doStop) {
      this.clearTimer();
    }

    if (doStart) {
      if (this.periodic) {
        this.clearTimer();
        if (this.periodicUnit === "beats") {
          if (immediate) {
            // The immediate tick is the first of the grid, so the ticks after
            // it are measured from when it fired rather than from now: it
            // fires late whenever the page is busy (rendering the press that
            // started it, say), and a grid measured from now would make the
            // first interval short by that much.
            this.__beatTimer = setTimeout(() => {
              this.scheduleBeatTick(process, Date.now());
              process();
            }, IMMEDIATE_DELAY);
          } else {
            this.scheduleBeatTick(process, Date.now());
          }
        } else {
          let intervalMs: number;
          if (this.periodicUnit === "bpm") {
            intervalMs = 60000 / this.periodicValue;
          } else if (this.periodicUnit === "hz") {
            intervalMs = 1000 / this.periodicValue;
          } else {
            intervalMs = this.toMs(this.periodicValue, this.periodicUnit);
          }
          this.__timer = setInterval(process, intervalMs);
          if (immediate) {
            setTimeout(process, IMMEDIATE_DELAY);
          }
        }
      } else {
        if (this.hasSchedule()) {
          this.clearTimer();
        }
        if (immediate) {
          setTimeout(process, IMMEDIATE_DELAY);
        } else {
          setTimeout(
            process,
            this.toMs(this.oneShotDelay, this.oneShotDelayUnit),
          );
        }
      }
    }

    this.running = this.hasSchedule();
    this.app.notify(this, { running: this.running });
  }

  /**
   * One tick, a beat-measured interval after the previous one was due.
   *
   * Measured from when the previous tick was due rather than from when it
   * fired, so lateness in one tick is not carried into the next.
   */
  scheduleBeatTick(tick: () => void, previousDue: number): void {
    const due = previousDue + this.toMs(this.periodicValue, "beats");
    this.__beatTimer = setTimeout(
      () => {
        // Scheduled before ticking, so a tick that stops the timer (an `until`
        // reached) cancels the one after it.
        this.scheduleBeatTick(tick, due);
        tick();
      },
      Math.max(0, due - Date.now()),
    );
  }

  destroy(): void {
    this.clearTimer();
  }

  nextTimerArgument(params: Record<string, any> = {}): Record<string, any> {
    return {
      ...params,
      triggerCount: ++this.counter,
    };
  }

  // Delays each input on its own: one arriving while an earlier one is still
  // waiting waits its full delay too, so the timer behaves as a delay line.
  async process(params: any): Promise<any> {
    if (this.periodic || this.oneShotDelay === undefined) {
      return params;
    }

    // Rounded, not left to setTimeout, which truncates: delays that are
    // fractions of a beat (a swung third, say) would each come out short, and
    // a chain of them would lose a millisecond at every step. A zero delay
    // passes straight on: a timeout would still yield, and the browser clamps
    // nested timeouts to a few milliseconds each.
    const delayMs = Math.round(this.toMs(this.oneShotDelay, this.oneShotDelayUnit));
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const result = this.nextTimerArgument(params);
    this.app.notify(this, { counter: result.triggerCount });
    return result;
  }
}

export default {
  serviceName,
  serviceId,
  service: Timer,
};
