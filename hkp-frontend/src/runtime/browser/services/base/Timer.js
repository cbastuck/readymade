import moment from "moment";

import { sleep } from "./helpers";

const serviceId = "hookup.to/service/timer";
const serviceName = "Timer";

const IMMEDIATE_DELAY = 1;

class Timer {
  constructor(app, board, descriptor, id) {
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

  clearTimer() {
    if (this.__timer) {
      clearInterval(this.__timer);
      this.__timer = undefined;
      this.counter = 0;
      this.app.notify(this, { running: false, count: this.counter });
    }
  }

  configure(config) {
    const {
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
        this.counter > this.conditionUntilTriggercount
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
        const timeBetween = moment.duration(
          this.periodicValue,
          this.periodicUnit
        );

        this.__timer = setInterval(process, timeBetween.asMilliseconds());
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
            this.oneShotDelayUnit
          );
          setTimeout(process, delayBetween.asMilliseconds());
        }
      }
    }

    this.running = !!this.__timer;
    this.app.notify(this, { running: this.running });
  }

  destroy() {
    this.clearTimer();
  }

  nextTimerArgument(params = {}) {
    return {
      ...params,
      triggerCount: ++this.counter,
    };
  }

  async process(params) {
    if (this.periodic || this.oneShotDelay === undefined) {
      return params;
    }
    if (this.isSleeping) {
      console.warn(
        "Processing timer service while sleeping ... process dropped"
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
