/**
 * The MediaPipe Tasks Vision models Detect runs, and everything they need,
 * shipped with the app rather than fetched from a CDN: the native apps must
 * detect offline. Vite emits each file as an asset of its own, and the
 * library itself is imported only when a detector is first made — a board
 * without a Detect service never downloads any of it.
 *
 * Only the SIMD build of the Wasm runtime is shipped; every engine the app
 * runs in (WKWebView, WebView2, Android WebView, current browsers) has SIMD.
 */

import type { FaceDetector } from "@mediapipe/tasks-vision";
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import faceModelPath from "./models/blaze_face_short_range.tflite?url";

export type { FaceDetector };

/** BlazeFace short-range: faces within about two metres of the camera. */
export async function createFaceDetector(
  minDetectionConfidence: number,
): Promise<FaceDetector> {
  const { FaceDetector } = await import("@mediapipe/tasks-vision");
  return FaceDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      // The CPU delegate: the model is small enough to run in milliseconds,
      // and a WebGL context is one more thing a webview may refuse.
      baseOptions: { modelAssetPath: faceModelPath, delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence,
    },
  );
}
