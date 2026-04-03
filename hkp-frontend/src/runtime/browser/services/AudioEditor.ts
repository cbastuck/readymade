import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import {
  Data,
  convertToFloat32Array,
  convertToUint8Array,
  FloatRingBufferSymbol,
  isFloatRingBuffer,
} from "hkp-frontend/src/runtime/rest/Data";

import AudioEditorUI from "./AudioEditorUI";

const serviceId = "hookup.to/service/audioeditor";
const serviceName = "AudioEditor";

type State = {
  accumulatedAudio: Float32Array;
  maxLength: number;
};

class AudioEditor extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      accumulatedAudio: new Float32Array(0),
      maxLength: 48000 * 60, // Default: 60 seconds at 48kHz
    });
  }

  async configure(config: any) {
    if (config.action === "clear") {
      this.clearAudio();
    } else if (config.action === "play") {
      const { startSample, endSample } = config.params || {};
      if (typeof startSample === "number" && typeof endSample === "number") {
        this.playSelection(startSample, endSample);
      }
    }
    if (config.maxLength !== undefined) {
      this.state.maxLength = config.maxLength;
    }
    return config;
  }

  async process(params: Data) {
    if (!isFloatRingBuffer(params)) {
      return params;
    }
    // Convert incoming audio data to Float32Array
    const incomingAudio = convertToFloat32Array(params.array);

    // Accumulate the audio
    const currentLength = this.state.accumulatedAudio.length;
    const newLength = Math.min(
      currentLength + incomingAudio.length,
      this.state.maxLength,
    );

    const newAccumulated = new Float32Array(newLength);

    if (currentLength + incomingAudio.length <= this.state.maxLength) {
      // Simple append
      newAccumulated.set(this.state.accumulatedAudio, 0);
      newAccumulated.set(incomingAudio, currentLength);
    } else {
      // Ring buffer behavior - remove old data from the beginning
      const overflow =
        currentLength + incomingAudio.length - this.state.maxLength;
      newAccumulated.set(this.state.accumulatedAudio.subarray(overflow), 0);
      newAccumulated.set(incomingAudio, currentLength - overflow);
    }

    this.state.accumulatedAudio = newAccumulated;

    // Notify UI with updated accumulated audio
    this.app.notify(this, {
      onProcess: this.state.accumulatedAudio,
      timestamp: params.ts,
      id: params.id,
    });

    return params;
  }

  clearAudio() {
    this.state.accumulatedAudio = new Float32Array(0);
    this.app.notify(this, { onProcess: this.state.accumulatedAudio });
  }

  playSelection(startSample: number, endSample: number) {
    // Extract the selected portion of audio
    const selectedAudio = this.state.accumulatedAudio.slice(
      startSample,
      endSample,
    );

    // Convert to Uint8Array for Data format
    const uint8Array = convertToUint8Array(selectedAudio);

    // Create Data object
    const data: Data = {
      type: FloatRingBufferSymbol,
      array: uint8Array,
      id: Date.now(),
      ts: Date.now(),
    };

    // Inject into process chain
    this.app.next(this, data);
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
  ) => new AudioEditor(app, board, descriptor, id),
  createUI: AudioEditorUI,
};

export default descriptor;
