/**
 * Getting frames out of a camera, apart from anything that draws.
 *
 * The Camera service holds no stream of its own. It captures through whatever
 * mounted a video element and handed it a screenshooter — its service panel, or
 * a facade's camera widget — because only something on screen can ask for the
 * camera and show that it is on. Both need the same three steps, so they live
 * here rather than in whichever grew them first.
 */

export async function startVideoStream(
  video: HTMLVideoElement,
  deviceId?: string,
): Promise<MediaStream> {
  if (!navigator.mediaDevices) {
    throw new Error("Can not initialize video");
  }
  const constraints: MediaStreamConstraints = deviceId
    ? { video: { deviceId } }
    : { video: true };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  void video.play();
  return stream;
}

export function stopVideoStream(
  stream: MediaStream | null,
  video?: HTMLVideoElement | null,
): void {
  if (!stream) {
    return;
  }
  stream.getTracks?.().forEach((track) => track.stop());
  stream.getVideoTracks?.().forEach((track) => track.stop());
  if (video) {
    video.srcObject = null;
  }
}

/**
 * One frame, at the capture size rather than the size it is shown at — the
 * picture the pipeline gets is not the picture on screen.
 *
 * The canvas is the caller's, held across calls: a board capturing several
 * times a second would otherwise build one per frame.
 */
export function captureFrame(
  video: HTMLVideoElement | null,
  canvasRef: { current: HTMLCanvasElement | null },
  width: number,
  height: number,
  format: string,
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx || !video) {
      resolve(null);
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    canvasRef.current.toBlob(resolve, format);
  });
}
