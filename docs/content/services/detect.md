# Detect

Finds faces in an image, on the device, and reports where they are on every frame — none included.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/detect` |

---

## What it does

Detect looks at the image in its input and reports what it finds. It runs
Google's [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector)
in the page, with the model and its WebAssembly runtime shipped with the app:
nothing is sent anywhere, and it works offline in the native apps.

It is a reporter. Every frame produces a report — `count: 0` when nothing is
there — so the pipeline after it can see absence as well as presence. Deciding
what a finding *means* is the pipeline's job: [Changes](changes.md) turns "a
face is there" into "a face appeared", [Filter](filter.md) keeps frames with
more than one, [Debounce](debounce.md) spaces out what follows.

### Modes

| Mode | Finds | Model |
|---|---|---|
| `face` | Faces, with a bounding box and six keypoints (eyes, ears, nose, mouth) | BlazeFace short-range — faces within about two metres of the camera |

The service is scoped by what it does — finding things in an image — so further
modes (objects, hands) belong here, each reporting under its own key.

### Loading

The model is loaded when the service is first configured — which a board does
when it opens — so the first frame usually does not wait. The panel says
whether it is loading, ready or failed. A board without a Detect service never
downloads any of it: the runtime (about 11.8 MB, 3.5 MB compressed) and the
model (230 KB) are separate files, fetched on first use.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"face"` | `"face"` | What to look for |
| `minConfidence` | `number` | `0.5` | Detections scoring below this (0–1) are left out |

The panel shows the last frame with each finding outlined, so the threshold can
be set by eye. A facade shows the same view with a `detect` widget:

```json
{ "type": "detect", "serviceUuid": "detect-svc", "width": 320 }
```

Pair it with the camera widget's `"preview": false`, which still captures but
draws nothing, so the frame appears once — as the board sees it.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | An image: a `Blob`, an object with an `image` field (what [Camera](camera.md) sends), an `ImageBitmap`, or an image, canvas or video element |
| **Output** | The input with the findings added: `{ ...input, faces, count, frame }`. A bare image travels on as `image` |

```json
{
  "image": "<Blob>",
  "count": 1,
  "frame": { "width": 640, "height": 480 },
  "faces": [
    {
      "score": 0.93,
      "box": { "x": 212, "y": 96, "width": 180, "height": 180 },
      "keypoints": [{ "x": 260, "y": 150 }, { "x": 340, "y": 152 }]
    }
  ]
}
```

Boxes and keypoints are in pixels of `frame`. An input with no image in it
stops the pipeline and is reported in the panel.

---

## Typical uses

Tell someone when a face appears — the [Face Alert](../boards/face-alert-board.md) board:

Timer → Camera → **Detect** → [Changes](changes.md) (`params.count > 0`, rise) → Debounce → Map → ntfy block

Count the people in front of a screen:

Timer → Camera → **Detect** → Map `{ "people=": "params.count" }` → Monitor
