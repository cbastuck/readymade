import { toArrayBuffer } from "../helpers";

export function toAudioBuffer(blobOrFile, audioCtx = null) {
  return new Promise(async (resolve, reject) => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    const ab = await toArrayBuffer(blobOrFile);
    audioCtx.decodeAudioData(ab, resolve, reject);
  });
}

export function decodeBuffer(audioCtx, data) {
  return new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(data, resolve, reject);
  });
}

export function combineChannels(audioBuffer) {
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const len = left.length;
  for (let i = 0; i < len; ++i) {
    left[i] += right[i];
    left[i] /= 2;
  }
  return left;
}
