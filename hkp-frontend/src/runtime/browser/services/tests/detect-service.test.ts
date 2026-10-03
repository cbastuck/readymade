import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Detect reports what it finds on every frame — none included — and keeps
 * the rest of the input, so the pipeline decides what a finding means. The
 * MediaPipe detector is replaced here: what is under test is the service
 * around it, not the model.
 */

const detections = vi.hoisted(() => ({ current: [] as any[] }));
const created = vi.hoisted(() => ({ count: 0, options: [] as any[] }));

vi.mock("../detect/mediapipe", () => ({
  createFaceDetector: vi.fn(async () => {
    created.count++;
    return {
      detect: vi.fn(() => ({ detections: detections.current })),
      setOptions: vi.fn(async (options: any) => created.options.push(options)),
      close: vi.fn(),
    };
  }),
}));

import DetectDescriptor, { imageOf } from "../Detect";

function makeDetect(state: Record<string, unknown> = {}) {
  const app = { notify: vi.fn(), next: vi.fn(), sendAction: vi.fn() } as any;
  const service = DetectDescriptor.create(app, "board", {} as any, "detect-1") as any;
  service.configure(state);
  return { service, app };
}

/** A canvas stands in for a frame: jsdom has no createImageBitmap for Blobs. */
function frame(width = 200, height = 100) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const FACE = {
  categories: [{ score: 0.9 }],
  boundingBox: { originX: 10, originY: 20, width: 30, height: 40 },
  keypoints: [{ x: 0.5, y: 0.5 }],
};

describe("Detect", () => {
  beforeEach(() => {
    detections.current = [];
    created.count = 0;
    created.options = [];
  });

  it("reports faces in pixels of the frame, keeping the rest of the input", async () => {
    detections.current = [FACE];
    const { service } = makeDetect();
    const image = frame();
    const out = await service.process({ image, at: 1 });
    expect(out).toEqual({
      image,
      at: 1,
      count: 1,
      frame: { width: 200, height: 100 },
      faces: [
        {
          score: 0.9,
          box: { x: 10, y: 20, width: 30, height: 40 },
          keypoints: [{ x: 100, y: 50 }],
        },
      ],
    });
  });

  it("reports a frame without faces rather than stopping", async () => {
    const { service } = makeDetect();
    const out = await service.process(frame());
    expect(out.count).toBe(0);
    expect(out.faces).toEqual([]);
    // A bare image travels on as `image`.
    expect(out.image).toBeInstanceOf(HTMLCanvasElement);
  });

  it("stops on an input with no image in it", async () => {
    const { service } = makeDetect();
    expect(await service.process({ text: "no picture" })).toBeNull();
  });

  it("loads the model once, from the first configure, and applies a new confidence to it", async () => {
    const { service } = makeDetect();
    await service.process(frame());
    await service.process(frame());
    expect(created.count).toBe(1);
    service.configure({ minConfidence: 0.8 });
    await vi.waitFor(() => expect(created.options).toEqual([{ minDetectionConfidence: 0.8 }]));
  });

  it("reports a Blob it cannot decode, and stops, rather than failing the pipeline", async () => {
    const { service, app } = makeDetect();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("The source image could not be decoded.");
    }));
    try {
      await expect(service.process(new Blob(["not an image"]))).resolves.toBeNull();
      expect(app.sendAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "notification" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("finds the image where Camera puts it, or takes the input as one", () => {
    const blob = new Blob(["x"], { type: "image/png" });
    expect(imageOf(blob)).toBe(blob);
    expect(imageOf({ image: blob })).toBe(blob);
    expect(imageOf({ image: "not an image" })).toBeNull();
    expect(imageOf(undefined)).toBeNull();
  });
});
