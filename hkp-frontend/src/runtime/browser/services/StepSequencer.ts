import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import StepSequencerUI from "./StepSequencerUI";

const serviceId = "hookup.to/service/step-sequencer";
const serviceName = "Step Sequencer";

export const STEP_COUNT = 16;
export const TRACKS = [
  { name: "Kick",  note: "C4" },
  { name: "Snare", note: "D4" },
  { name: "Hi-hat", note: "E4" },
] as const;

type State = {
  steps: boolean[][];
  bpm: number;
  playing: boolean;
  currentStep: number;
};

class StepSequencer extends ServiceBase<State> {
  private _timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      steps: TRACKS.map(() => Array<boolean>(STEP_COUNT).fill(false)),
      bpm: 120,
      playing: false,
      currentStep: 0,
    });
  }

  configure(config: any) {
    const { bpm, playing, steps, command } = config;

    if (bpm !== undefined) {
      this.state.bpm = Math.max(20, Math.min(300, bpm));
      this.app.notify(this, { bpm: this.state.bpm });
      if (this.state.playing) {
        this._startTimer();
      }
    }

    if (steps !== undefined) {
      this.state.steps = steps;
      this.app.notify(this, { steps: this.state.steps });
    }

    if (command?.action === "toggle-step") {
      const { track, step } = command.params as { track: number; step: number };
      this.state.steps[track][step] = !this.state.steps[track][step];
      this.app.notify(this, { steps: this.state.steps });
    }

    if (playing !== undefined) {
      if (playing && !this.state.playing) {
        this._startTimer();
      } else if (!playing && this.state.playing) {
        this._stopTimer();
      }
    }

    if (command?.action === "play") {
      this._startTimer();
    } else if (command?.action === "stop") {
      this._stopTimer();
    }
  }

  private _tick() {
    const step = this.state.currentStep;
    const activeNotes: { note: string }[] = [];

    for (let t = 0; t < TRACKS.length; t++) {
      if (this.state.steps[t]?.[step]) {
        activeNotes.push({ note: TRACKS[t].note });
      }
    }

    this.state.currentStep = (step + 1) % STEP_COUNT;
    this.app.notify(this, { currentStep: this.state.currentStep });

    if (activeNotes.length > 0) {
      this.app.next(this, activeNotes);
    }
  }

  private _startTimer() {
    this._stopTimer();
    const intervalMs = (60 / this.state.bpm / 4) * 1000;
    this.state.currentStep = 0;
    this.state.playing = true;
    this._timer = setInterval(() => this._tick(), intervalMs);
    this.app.notify(this, { playing: true, currentStep: 0 });
  }

  private _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
    this.state.playing = false;
    this.app.notify(this, { playing: false });
  }

  destroy() {
    this._stopTimer();
  }

  async process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new StepSequencer(app, board, descriptor, id),
  createUI: StepSequencerUI,
};

export default descriptor;
