import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import {
  convertToFloat32Array,
  convertToUint8Array,
  isFloatRingBuffer,
} from "../../realtime/Data";

const serviceId = "hookup.to/service/moog";
const serviceName = "MoogFilter";

type State = {
  cutoff: number;
  resonance: number;
};

class MoogService extends ServiceBase<State> {
  _filter: ReturnType<typeof MoogFilter>;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      cutoff: 1000,
      resonance: 0.1,
    });
    this._filter = MoogFilter(44100); // Assuming a sample rate of 44100 Hz
  }

  async configure(config: any) {
    if (config.cutoff) {
      this._filter.setCutoff(config.cutoff);
      this.state.cutoff = config.cutoff;
    }
    if (config.resonance) {
      this._filter.setResonance(config.resonance);
      this.state.resonance = config.resonance;
    }
    return config;
  }

  async process(params: any) {
    if (isFloatRingBuffer(params)) {
      const array: Uint8Array = params.array;
      const floatArray = convertToFloat32Array(array);
      const processedArray = floatArray.map((x) => this._filter.process(x));

      return {
        ...params,
        array: convertToUint8Array(processedArray),
      };
    }
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
    id: string
  ) => new MoogService(app, board, descriptor, id),
};

function MoogFilter(sampleRate: number) {
  let cutoff = 1000;
  let resonance = 0.1;

  let y1 = 0,
    y2 = 0,
    y3 = 0,
    y4 = 0;
  let oldx = 0,
    oldy1 = 0,
    oldy2 = 0,
    oldy3 = 0;

  function setCutoff(freq: number) {
    cutoff = Math.max(0, Math.min(freq, sampleRate / 2));
  }

  function setResonance(res: number) {
    resonance = Math.max(0, Math.min(res, 4)); // Typically between 0 and 4
  }

  function process(sample: number) {
    const f = (cutoff / sampleRate) * 1.16;
    const fb = resonance * (1.0 - 0.15 * f * f);

    let input = sample - y4 * fb;
    input *= 0.35013 * (f * f) * (f * f); // Pre-emphasis

    y1 = input + 0.3 * oldx + (1 - f) * y1;
    y2 = y1 + 0.3 * oldy1 + (1 - f) * y2;
    y3 = y2 + 0.3 * oldy2 + (1 - f) * y3;
    y4 = y3 + 0.3 * oldy3 + (1 - f) * y4;

    oldx = input;
    oldy1 = y1;
    oldy2 = y2;
    oldy3 = y3;

    return y4;
  }

  return {
    setCutoff,
    setResonance,
    process,
  };
}

export default descriptor;
