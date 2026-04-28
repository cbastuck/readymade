# GIF Recorder

Captures a sequence of image frames from the pipeline and encodes them into an animated GIF.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/gif-encoder` |

---

## What it does

GIF Recorder buffers incoming image frames while in recording mode. Each frame (provided as a `Blob` containing image data) is drawn onto an off-screen canvas and quantised to a fixed 256-colour 3-3-2 RGB palette. When recording is stopped, the buffered frames are encoded into a valid GIF89a binary stream and emitted as a `Blob` downstream.

The encoder is implemented entirely in the browser with no server round-trip.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `recording` | `boolean` | `false` | `true` to start recording; `false` to stop and emit the GIF |
| `delayMs` | `number` | `100` | Inter-frame delay in milliseconds (controls playback speed) |
| `maxFrames` | `number` | `100` | Maximum number of frames to buffer before stopping automatically |

Toggling `recording` from `true` to `false` triggers encoding and emits the GIF.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `Blob` — an image frame (JPEG, PNG, or any browser-decodable format) |
| **Output** | `Blob` — an animated GIF, emitted once when recording stops |

---

## Colour depth

The encoder uses a fixed 3-3-2 RGB palette (256 colours). This gives fast encoding without per-frame palette computation, at the cost of colour fidelity. It is well-suited for simple animations, game renders, and camera captures.

---

## Typical pipeline

```
Camera → GIF Recorder → Monitor
```

Start recording, wave at the camera, stop recording. Monitor receives the GIF blob which can then be uploaded, displayed, or forwarded.
