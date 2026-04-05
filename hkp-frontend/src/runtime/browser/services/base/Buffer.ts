import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/buffer
 * Service Name: Buffer
 * Modes: capacity flush | interval flush | accumulatedOutput
 * Key Config: capacity, interval, accumulatedOutput, action=clear
 * Input: any
 * Output: buffered array slice/full buffer/null depending on configuration and timing
 * Arrays: concatenates input arrays into internal buffer
 * Binary: can carry binary payloads as opaque values
 * MixedData: not native in browser runtime
 */

const serviceId = "hookup.to/service/buffer";
const serviceName = "Buffer";

class Buffer {
  uuid: string;
  board: string;
  app: AppInstance;
  buffer: Array<any>;
  capacity: number;
  interval: number;
  accumulatedOutput: boolean;

  _timer: NodeJS.Timeout | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.buffer = [];
    this.capacity = 100;
    this.interval = -1;
    this.accumulatedOutput = false;
  }

  destroy = () => {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  };

  configure(config: any) {
    const { capacity, action, command, interval, accumulatedOutput } = config;

    if (capacity !== undefined) {
      this.capacity = capacity;
      this.app.notify(this, { capacity });
    }

    if (action === "clear") {
      this.buffer = [];
      this.app.notify(this, { buffer: this.buffer });
    }

    if (command !== undefined) {
      if (command.action === "inject") {
        this.app.next(this, command.params);
      }
    }

    if (needsUpdate(interval, this.interval)) {
      this.interval = interval;
      this.app.notify(this, { interval });
      this.scheduleNextTimer();
    }

    if (needsUpdate(accumulatedOutput, this.accumulatedOutput)) {
      this.accumulatedOutput = accumulatedOutput;
      this.app.notify(this, { accumulatedOutput });
    }
  }

  clearTimer = () => {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  };

  scheduleNextTimer = () => {
    this.clearTimer();
    if (this.interval > 0) {
      this._timer = setTimeout(this.onTimeout, this.interval * 1000); // interval is in sec -> convert to msec
    }
  };

  onTimeout = () => {
    this._timer = undefined; // reset this callback
    if (this.buffer.length > 0) {
      this.app.next(this, this.buffer);
      this.buffer = [];
    }
    this.scheduleNextTimer();
  };

  reduceBuffer = () => {
    const agg = this.buffer.slice(0, this.capacity);
    this.buffer = this.buffer.slice(this.capacity);
    return agg;
  };

  process(params: any) {
    if (this.capacity === 0 && this.interval <= 0) {
      console.warn("Buffer misconfigured, stop propagation");
      return null;
    }

    this.buffer = this.buffer.concat(params);
    if (this.buffer.length > this.capacity && this.capacity > 0) {
      const processedSlice = this.reduceBuffer();
      this.app.notify(this, { buffer: this.buffer });
      this.scheduleNextTimer(); // cancel and reschedule if needed
      return processedSlice;
    }

    this.app.notify(this, { buffer: this.buffer });
    if (this.accumulatedOutput) {
      return this.buffer;
    }

    return null;
  }
}

export default {
  serviceName,
  serviceId,
  service: Buffer,
  Buffer,
};
