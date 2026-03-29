import { toArrayBuffer } from "../helpers";

export function toAudioBuffer(
  blobOrFile: Blob | File,
  audioCtx: AudioContext | null = null
): Promise<AudioBuffer> {
  return new Promise(async (resolve, reject) => {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    const ab = await toArrayBuffer(blobOrFile);
    (audioCtx as AudioContext).decodeAudioData(ab, resolve, reject);
  });
}

export function decodeBuffer(
  audioCtx: AudioContext,
  data: ArrayBuffer
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(data, resolve, reject);
  });
}

export function combineChannels(audioBuffer: AudioBuffer): Float32Array {
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const len = left.length;
  for (let i = 0; i < len; ++i) {
    left[i] += right[i];
    left[i] /= 2;
  }
  return left;
}
