*Captures frames from the device camera and emits them as image Blobs.*

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/camera` |

---

## What it does

Camera connects to the device's camera (webcam or phone camera) and,
when triggered, captures a snapshot as a Blob. The Blob can be passed
to a Canvas service (`type: "image"`) for display, or to an Output
service to stream frames to a server.

The capture is **on-demand** — it happens when the service receives a
pipeline trigger or when `action: "triggerSnapshot"` is sent via
`configure`. The camera does not continuously push frames; pair it with
a Timer to achieve periodic capture.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `captureAs` | `"image"` | `"image"` | Output format (currently `"image"` only) |
| `captureFormat` | `string` | `"image/png"` | MIME type of the captured Blob (e.g. `"image/jpeg"`) |

### Commands

| `action` | Description |
|---|---|
| `"triggerSnapshot"` | Capture a frame immediately and fire it through the pipeline via `app.next()` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — receipt of any upstream data triggers a capture |
| **Output** | A `Blob` containing the captured image |

---

## Permissions

The browser will prompt for camera permission the first time the service
connects. If permission is denied, the service will not capture frames.

---

## Example: periodic webcam snapshots to Canvas

```json
[
  {
    "serviceId": "hookup.to/service/timer",
    "state": { "periodicValue": 500, "periodicUnit": "ms", "periodic": true, "running": true }
  },
  {
    "serviceId": "hookup.to/service/camera",
    "state": { "captureFormat": "image/jpeg" }
  },
  {
    "serviceId": "hookup.to/service/map",
    "state": {
      "template": { "type": "image", "data=": "params" }
    }
  },
  {
    "serviceId": "hookup.to/service/canvas",
    "state": { "size": [640, 480], "clearOnRedraw": true }
  }
]
```
