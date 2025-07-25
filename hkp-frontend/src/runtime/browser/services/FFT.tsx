import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { isFloatRingBuffer } from "../../realtime/Data";

const serviceId = "hookup.to/service/fft";
const serviceName = "FFT";

type State = unknown;

class FFT extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
  }

  async configure(config: any) {
    return config;
  }

  async process(params: any) {
    if (isFloatRingBuffer(params)) {
      const array: Uint8Array = params.array;
      const floatArray = new Float32Array(
        array.buffer,
        array.byteOffset,
        array.length / 4
      );
      return realFFT(floatArray).magnitude;
    }
    return params;
  }
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
};

export default descriptor;
