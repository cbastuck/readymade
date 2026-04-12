import moment, { unitOfTime } from "moment";

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { sleep } from "./helpers";

/**
 * Service Documentation
 * Service ID: hookup.to/service/timer
 * Service Name: Timer
 * Modes: periodic | oneShot
 * Key Config: periodic, periodicValue, periodicUnit, oneShotDelay, oneShotDelayUnit, running, start, stop, restart, immediate, until.triggerCount
 * Input: any payload (used in delayed one-shot process path)
 * Output: tick payload with triggerCount and optional pass-through fields
 * Arrays: treated as generic input payloads
 * Binary: pass-through in delayed processing mode
 * MixedData: not native in browser runtime
 */

const serviceId = "hookup.to/service/timer";
const serviceName = "Timer";

const IMMEDIATE_DELAY = 1;

class Timer {
  uuid: string;
  board: string;
  app: AppInstance;

  __timer: ReturnType<typeof setInterval> | undefined;
  counter: number;
  periodic: boolean;
  periodicValue: number;
  periodicUnit: string;
  oneShotDelay: number;
  oneShotDelayUnit: string;
  running: boolean;
  conditionUntilTriggercount: number | undefined;
  isSleeping: boolean | undefined;
  sleeping: ReturnType<typeof setTimeout> | undefined;

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
    this.running = false;
  }

  clearTimer(): void {
    if (this.__timer) {
      clearInterval(this.__timer);
      this.__timer = undefined;
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
      if (this.__timer) {
        clearInterval(this.__timer);
        this.__timer = undefined;
      }
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
        let intervalMs: number;
        if (this.periodicUnit === "bpm") {
          intervalMs = 60000 / this.periodicValue;
        } else if (this.periodicUnit === "hz") {
          intervalMs = 1000 / this.periodicValue;
        } else {
          intervalMs = moment.duration(
            this.periodicValue,
            this.periodicUnit as unitOfTime.DurationConstructor,
          ).asMilliseconds();
        }

        this.__timer = setInterval(process, intervalMs);
        if (immediate) {
          setTimeout(process, IMMEDIATE_DELAY);
        }
      } else {
        if (this.__timer) {
          this.clearTimer();
        }
        if (immediate) {
          setTimeout(process, IMMEDIATE_DELAY);
        } else {
          const delayBetween = moment.duration(
            this.oneShotDelay,
            this.oneShotDelayUnit as unitOfTime.DurationConstructor,
          );
          setTimeout(process, delayBetween.asMilliseconds());
        }
      }
    }

    this.running = !!this.__timer;
    this.app.notify(this, { running: this.running });
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

  async process(params: any): Promise<any> {
    if (this.periodic || this.oneShotDelay === undefined) {
      return params;
    }
    if (this.isSleeping) {
      console.warn(
        "Processing timer service while sleeping ... process dropped",
      );
      clearTimeout(this.sleeping);
      this.sleeping = undefined;
      return params;
    }

    this.isSleeping = true;
    const sleeptime =
      this.oneShotDelayUnit === "s"
        ? this.oneShotDelay * 1000
        : this.oneShotDelay;
    await sleep(sleeptime);
    this.isSleeping = undefined;

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
