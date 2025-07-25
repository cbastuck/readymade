import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import {
  convertToFloat32Array,
  convertToUint8Array,
  isFloatRingBuffer,
} from "../../realtime/Data";

const serviceId = "hookup.to/service/delay";
const serviceName = "Delay";

type State = {
  delayTimeMs: number;
};

class Delay extends ServiceBase<State> {
  _delayProcessor: ReturnType<typeof DelayProcessor>;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      delayTimeMs: 0.5, // Default delay time in seconds
    });
    this._delayProcessor = DelayProcessor(44100); // Assuming a sample rate of 44100 Hz
  }

  async configure(config: any) {
    if (config.time) {
      this._delayProcessor.setDelayTime(config.time * 1000); // Convert to milliseconds
      this.state.delayTimeMs = config.time;
    }
    return config;
  }

  async process(params: any) {
    if (isFloatRingBuffer(params)) {
      const array: Uint8Array = params.array;
      const floatArray = convertToFloat32Array(array);
      const processedArray = floatArray.map((x) =>
        this._delayProcessor.process(x)
      );

      return {
        ...params,
        array: convertToUint8Array(processedArray),
      };
    }
    return params;
  }
}

function DelayProcessor(sampleRate: number, maxDelayMs = 2000) {
  const maxSamples = Math.floor((maxDelayMs / 1000) * sampleRate);
  const buffer = new Float32Array(maxSamples);
  let writeIndex = 0;

  let delayTimeMs = 500;
  let feedback = 0.5;
  let mix = 0.5;

  function setDelayTime(ms: number) {
    delayTimeMs = Math.max(0, Math.min(ms, maxDelayMs));
  }

  function setFeedback(fb: number) {
    feedback = Math.max(0, Math.min(fb, 0.999)); // Avoid runaway
  }

  function setMix(m: number) {
    mix = Math.max(0, Math.min(m, 1));
  }

  function process(input: number): number {
    const delaySamples = Math.floor((delayTimeMs / 1000) * sampleRate);
    const readIndex = (writeIndex - delaySamples + maxSamples) % maxSamples;

    const delayed = buffer[readIndex];
    const output = input * (1 - mix) + delayed * mix;

    buffer[writeIndex] = input + delayed * feedback;

    writeIndex = (writeIndex + 1) % maxSamples;

    return output;
  }

  return {
    setDelayTime,
    setFeedback,
    setMix,
    process,
  };
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new Delay(app, board, descriptor, id),
};

export default descriptor;
