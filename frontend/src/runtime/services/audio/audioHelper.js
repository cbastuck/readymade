
export function decodeBuffer(audioCtx, data) {
  return new Promise((resolve, reject) => 
    audioCtx.decodeAudioData(
      data, 
      buffer => resolve(buffer),
      e => reject(e)
    )
  );
}

export function combineChannels(audioBuffer) {
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const len = left.length;
  for (let i=0; i<len; ++i) {
    left[i] += right[i];
    left[i] /= 2;
  }
  return left;
}