import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import MicrophoneMonitorUI from "./MicrophoneMonitorUI";

const serviceId = "hookup.to/service/microphone-monitor";
const serviceName = "Microphone Monitor";

type State = {
  interval: number;
  running: boolean;
  status: string | null;
  level: number | null;
  levelDb: number | null;
};

type TimeDomainDataBuffer = Parameters<
  AnalyserNode["getFloatTimeDomainData"]
>[0];

class MicrophoneMonitor extends ServiceBase<State> {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private dataArray: TimeDomainDataBuffer | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      interval: 500,
      running: false,
      status: null,
      level: null,
      levelDb: null,
    });
  }

  private async startCapture(): Promise<void> {
    if (this.audioContext) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Microphone requires a secure context (HTTPS or localhost)";
      this.state.status = `error: ${msg}`;
      this.app.notify(this, { status: this.state.status });
      throw new Error(msg);
    }

    this.state.status = "requesting mic...";
    this.app.notify(this, { status: this.state.status });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      this.dataArray = new Float32Array(this.analyser.fftSize);

      this.state.status = "active";
      this.app.notify(this, { status: this.state.status });
    } catch (err: any) {
      this.state.status = `error: ${err.message}`;
      this.app.notify(this, { status: this.state.status });
      throw err;
    }
  }

  private measureLevel(): { level: number; levelDb: number } {
    if (!this.analyser || !this.dataArray) {
      return { level: 0, levelDb: -Infinity };
    }

    this.analyser.getFloatTimeDomainData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    const levelDb = 20 * Math.log10(Math.max(rms, 1e-10));

    return { level: rms, levelDb };
  }

  private startMeasuring(): void {
    this.stopMeasuring();

    this.intervalId = setInterval(() => {
      const { level, levelDb } = this.measureLevel();
      this.state.level = level;
      this.state.levelDb = levelDb;
      this.app.notify(this, { level, levelDb });
      this.app.next(this, { level, levelDb, timestamp: Date.now() });
    }, this.state.interval);

    this.state.running = true;
    this.app.notify(this, { running: true });
  }

  private stopMeasuring(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private stopCapture(): void {
    this.stopMeasuring();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.state.running = false;
    this.state.status = null;
    this.app.notify(this, { running: false, status: null });
  }

  async configure(config: any) {
    const { interval, running, start, stop } = config;

    const doStop = stop || (this.state.running && running === false);
    let doStart = start || running === true;

    if (interval !== undefined && interval !== this.state.interval) {
      this.state.interval = interval;
      this.app.notify(this, { interval });
      if (this.state.running) {
        // restart interval with new period without re-requesting mic
        this.stopMeasuring();
        doStart = true;
      }
    }

    if (doStop) {
      this.stopCapture();
      return this.state;
    }

    if (doStart) {
      try {
        await this.startCapture();
        this.startMeasuring();
      } catch {
        // error already notified in startCapture
      }
    }

    return this.state;
  }

  process(params: any) {
    return params;
  }

  destroy(): void {
    this.stopCapture();
  }
}

export default {
  serviceName,
  serviceId,
  create(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    return new MicrophoneMonitor(app, board, descriptor, id);
  },
  createUI: MicrophoneMonitorUI,
};
