import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { isFloatRingBuffer } from "../../realtime/Data";
import FFTUI from "./FFTUI";

const serviceId = "hookup.to/service/fft";
const serviceName = "FFT";

type WindowFunction = "none" | "hann" | "hamming" | "blackman" | "rectangular";
type OutputFormat = "magnitude" | "power" | "db";

type State = {
  windowFunction: WindowFunction;
  outputFormat: OutputFormat;
  fftSize: number | null;
};

class FFT extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      windowFunction: "none",
      outputFormat: "magnitude",
      fftSize: null,
    });
  }

  async configure(config: any) {
    const { windowFunction, outputFormat, fftSize } = config;
    if (windowFunction !== undefined) {
      this.state.windowFunction = windowFunction;
      this.app.notify(this, { windowFunction });
    }
    if (outputFormat !== undefined) {
      this.state.outputFormat = outputFormat;
      this.app.notify(this, { outputFormat });
    }
    if (fftSize !== undefined) {
      if (fftSize === "auto") {
        this.state.fftSize = null;
      } else {
        this.state.fftSize = fftSize;
      }
      this.app.notify(this, { fftSize });
    }

    return this.state;
  }

  async process(params: any) {
    if (isFloatRingBuffer(params)) {
      const array: Uint8Array = params.array;
      let floatArray = new Float32Array(
        array.buffer,
        array.byteOffset,
        array.length / 4
      );

      // Resize to FFT size (zero-pad or truncate) - only if fftSize is set
      if (
        this.state.fftSize !== null &&
        floatArray.length !== this.state.fftSize
      ) {
        const resized = new Float32Array(this.state.fftSize);
        const copyLength = Math.min(floatArray.length, this.state.fftSize);
        resized.set(floatArray.subarray(0, copyLength));
        floatArray = resized;
      }

      // Apply window function - only if windowFunction is set
      const processArray =
        this.state.windowFunction !== null
          ? applyWindow(floatArray, this.state.windowFunction)
          : floatArray;

      // Perform FFT
      const fftResult = realFFT(processArray);

      switch (this.state.outputFormat) {
        case "magnitude":
          return fftResult.magnitude;
        case "power":
          return fftResult.magnitude.map((m: number) => m * m);
        case "db":
          return fftResult.magnitude.map(
            (m: number) => 20 * Math.log10(Math.max(m, 1e-10))
          );
        default:
          return fftResult.magnitude;
      }
    }
    return params;
  }
}

function applyWindow(
  signal: Float32Array,
  windowType: WindowFunction
): Float32Array {
  const N = signal.length;
  const windowed = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    let w = 1.0;

    switch (windowType) {
      case "hann":
        w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        break;
      case "hamming":
        w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
        break;
      case "blackman":
        w =
          0.42 -
          0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
          0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
        break;
      case "rectangular":
        w = 1.0;
        break;
    }

    windowed[i] = signal[i] * w;
  }

  return windowed;
}

function realFFT(signal: any) {
  const N = signal.length;

  if ((N & (N - 1)) !== 0) throw new Error("Length must be a power of 2");

  // Initialize real and imaginary parts
  const real = signal.slice(); // copy of input
  const imag = new Array(N).fill(0);

  // Perform complex FFT
  fft(real, imag);

  // Return magnitude and phase (or real/imag if you want)
  const magnitude = new Array(N / 2);
  const phase = new Array(N / 2);

  for (let i = 0; i < N / 2; i++) {
    const re = real[i];
    const im = imag[i];
    magnitude[i] = Math.hypot(re, im);
    phase[i] = Math.atan2(im, re);
  }

  return { real, imag, magnitude, phase };
}

function fft(real: any, imag: any) {
  const N = real.length;

  if (N !== imag.length) {
    throw new Error("Mismatched lengths");
  }
  if ((N & (N - 1)) !== 0) {
    throw new Error("Input length must be a power of 2");
  }

  // Bit-reversal permutation
  const bitReversedIndices = new Uint32Array(N);
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let j = 0;
    for (let k = 0; k < bits; k++) {
      j = (j << 1) | ((i >>> k) & 1);
    }
    bitReversedIndices[i] = j;
  }

  for (let i = 0; i < N; i++) {
    if (i < bitReversedIndices[i]) {
      [real[i], real[bitReversedIndices[i]]] = [
        real[bitReversedIndices[i]],
        real[i],
      ];
      [imag[i], imag[bitReversedIndices[i]]] = [
        imag[bitReversedIndices[i]],
        imag[i],
      ];
    }
  }

  // Cooley-Tukey FFT
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2;
    const theta = (-2 * Math.PI) / size;
    const wtemp = Math.sin(0.5 * theta);
    const wpr = -2.0 * wtemp * wtemp;
    const wpi = Math.sin(theta);
    let wr = 1.0;
    let wi = 0.0;

    for (let m = 0; m < half; m++) {
      for (let i = m; i < N; i += size) {
        const j = i + half;
        const tempr = wr * real[j] - wi * imag[j];
        const tempi = wr * imag[j] + wi * real[j];

        real[j] = real[i] - tempr;
        imag[j] = imag[i] - tempi;

        real[i] += tempr;
        imag[i] += tempi;
      }

      const wtemp = wr;
      wr += wr * wpr - wi * wpi;
      wi += wi * wpr + wtemp * wpi;
    }
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
  ) => new FFT(app, board, descriptor, id),
  createUI: FFTUI,
};

export default descriptor;
