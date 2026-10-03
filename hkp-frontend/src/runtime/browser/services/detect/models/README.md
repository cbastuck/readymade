# Detect models

Models the Detect service runs, shipped with the app so it detects offline.
Each is emitted by Vite as an asset of its own and loaded only when a Detect
service first runs (`../mediapipe.ts`).

| File | What | Source | Licence |
| --- | --- | --- | --- |
| `blaze_face_short_range.tflite` | BlazeFace short-range face detector, float16 (229,746 bytes, sha256 `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`) | https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite — see the [MediaPipe face detector guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector) and its model card | Apache-2.0, as MediaPipe publishes its solution models |

The Wasm runtime that runs them comes from the `@mediapipe/tasks-vision` npm
package (Apache-2.0) and is recorded with the other npm dependencies by
`scripts/collect-licenses.py`. This folder is not: that script discovers
vendored source under `3rdparty/`, so a model added here is recorded here.
