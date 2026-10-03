/**
 * Service Documentation
 * Service ID: hookup.to/service/detect
 * Service Name: Detect
 * Modes: face
 * Key Config: mode, minConfidence
 * IO: in=image (Blob, { image: Blob }, ImageBitmap, image/canvas/video element)
 *     -> out={ ...input, faces: [{ score, box, keypoints }], count, frame }
 */

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import DetectUI from "./DetectUI";
import { DETECT_MODES, DetectMode } from "./detect-modes";
import type { FaceDetector } from "./detect/mediapipe";

const serviceId = "hookup.to/service/detect";
const serviceName = "Detect";

type State = {
  mode: DetectMode;
  /** Detections scoring below this are left out, 0–1. */
  minConfidence: number;
};

export type Box = { x: number; y: number; width: number; height: number };
export type Face = {
  score: number;
  /** In pixels of the frame. */
  box: Box;
  /** Eyes, nose, mouth and ears, in pixels of the frame. */
  keypoints: Array<{ x: number; y: number }>;
};
export type Status = "idle" | "loading" | "ready" | "error";

type Drawable = Exclude<TexImageSource, VideoFrame | OffscreenCanvas>;

function isDrawable(value: unknown): value is Drawable {
  return (
    (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) ||
    (typeof HTMLImageElement !== "undefined" && value instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement) ||
    (typeof HTMLVideoElement !== "undefined" && value instanceof HTMLVideoElement) ||
    (typeof ImageData !== "undefined" && value instanceof ImageData)
  );
}

/** The image in an input: the input itself, or its `image` field (what Camera sends). */
export function imageOf(input: unknown): Blob | Drawable | null {
  const candidate =
    input instanceof Blob || isDrawable(input)
      ? input
      : input && typeof input === "object"
        ? (input as { image?: unknown }).image
        : undefined;
  if (candidate instanceof Blob || isDrawable(candidate)) {
    return candidate;
  }
  return null;
}

function sizeOf(image: Drawable): { width: number; height: number } {
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return { width: image.videoWidth, height: image.videoHeight };
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  return { width: image.width, height: image.height };
}

/**
 * Finds things in an image — faces, for now — and reports what it found on
 * every frame, none included. Whether a finding matters (a face that has just
 * appeared, say) is the pipeline's to decide: Changes, Filter, Debounce.
 *
 * Runs MediaPipe Tasks Vision in the page, from files shipped with the app
 * (`detect/mediapipe.ts`). The model is loaded when the service is first
 * configured, so the first frame does not wait for it.
 */
class Detect extends ServiceBase<State> {
  __detector: Promise<FaceDetector> | null = null;
  __status: Status = "idle";
  __confidence = 0.5;

  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { mode: "face", minConfidence: 0.5 });
  }

  /** Live, not saved: what the panel shows before any notification. */
  get status(): Status {
    return this.__status;
  }

  private setStatus(status: Status, error?: string) {
    this.__status = status;
    this.app.notify(this, { status, ...(error ? { error } : {}) });
  }

  private detector(): Promise<FaceDetector> {
    if (!this.__detector) {
      this.setStatus("loading");
      this.__confidence = this.state.minConfidence;
      this.__detector = import("./detect/mediapipe")
        .then(({ createFaceDetector }) => createFaceDetector(this.state.minConfidence))
        .then((detector) => {
          this.setStatus("ready");
          return detector;
        })
        .catch((err) => {
          // Forgotten, so the next frame tries again rather than failing for good.
          this.__detector = null;
          const message = err?.message ?? String(err);
          this.setStatus("error", message);
          this.pushErrorNotification(`Detect: could not load the model — ${message}`);
          throw err;
        });
    }
    return this.__detector;
  }

  configure(config: Partial<State>) {
    if (config.mode !== undefined && DETECT_MODES.includes(config.mode)) {
      this.state.mode = config.mode;
      this.app.notify(this, { mode: config.mode });
    }
    if (config.minConfidence !== undefined) {
      const value = Math.min(1, Math.max(0, Number(config.minConfidence)));
      if (Number.isFinite(value)) {
        this.state.minConfidence = value;
        this.app.notify(this, { minConfidence: value });
      }
    }
    // Loading starts with the first configure — a board restore configures
    // every service — so the model is there by the first frame. Not awaited:
    // a restore waits for each configure, and would wait for the model too.
    void this.applyOptions();
  }

  private async applyOptions() {
    const detector = await this.detector().catch(() => null);
    if (detector && this.__confidence !== this.state.minConfidence) {
      this.__confidence = this.state.minConfidence;
      await detector.setOptions({ minDetectionConfidence: this.state.minConfidence });
    }
  }

  async process(params: any): Promise<any> {
    const image = imageOf(params);
    if (!image) {
      // Nothing to look at is not a frame without faces: say so, pass nothing.
      this.app.notify(this, { error: "No image in the input" });
      return null;
    }
    let detector: FaceDetector;
    try {
      detector = await this.detector();
    } catch {
      return null;
    }

    let bitmap: ImageBitmap | null = null;
    try {
      // Inside the try: a Blob that is not an image a browser can decode is a
      // frame this service reports it cannot read, not a failed pipeline.
      bitmap = image instanceof Blob ? await createImageBitmap(image) : null;
      const source = bitmap ?? (image as Drawable);
      const frame = sizeOf(source);
      const result = detector.detect(source);
      const faces: Face[] = result.detections.map((detection) => ({
        score: detection.categories[0]?.score ?? 0,
        box: {
          x: detection.boundingBox?.originX ?? 0,
          y: detection.boundingBox?.originY ?? 0,
          width: detection.boundingBox?.width ?? 0,
          height: detection.boundingBox?.height ?? 0,
        },
        keypoints: detection.keypoints.map((point) => ({
          x: point.x * frame.width,
          y: point.y * frame.height,
        })),
      }));
      this.app.notify(this, {
        error: null,
        count: faces.length,
        found: { faces, frame, image: image instanceof Blob ? image : null },
      });
      const carried =
        params && typeof params === "object" && !(params instanceof Blob) && !isDrawable(params)
          ? params
          : { image: params };
      return { ...carried, faces, count: faces.length, frame };
    } catch (err: any) {
      this.pushErrorNotification(`Detect: ${err?.message ?? err}`);
      return null;
    } finally {
      bitmap?.close();
    }
  }

  destroy() {
    const pending = this.__detector;
    this.__detector = null;
    void pending?.then((detector) => detector.close()).catch(() => {});
  }
}

export default {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Detect(app, board, descriptor, id),
  createUI: DetectUI,
};
