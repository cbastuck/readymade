# Transient Detector

Detects onsets and transients in an audio stream and fires a trigger on each detected event.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `transient-detector` |

Requires an hkp-rt instance. Not available in the browser runtime.

---

## What it does

Transient Detector analyses incoming audio sample data and fires a
downstream pipeline trigger whenever a transient (sudden amplitude
increase) is detected. This makes it the natural bridge between audio
capture and event-driven pipelines — for example, driving visual effects
from live drum hits or speech onsets.

When no transient is detected, the service returns `null`, preventing
unnecessary downstream processing.

---

## Configuration

Configuration options depend on the detection algorithm implemented in
the hkp-rt version. Refer to the server-side header for the current
tuneable parameters (threshold, window size, etc.).

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Audio sample array or ring-buffer (typically from `core-input` or `wav-reader`) |
| **Output (transient detected)** | Detection event object (e.g. `{ "onset": true, "timestamp": … }`) |
| **Output (no transient)** | `null` — pipeline stops |

---

## Typical use

### Live beat detection driving a visual effect

```
core-input → transient-detector → map (draw pulse) → websocket-server
Browser:  Input → Canvas
```

Each detected drum hit fires a canvas draw command to the browser,
creating a frame-accurate visual response to the audio.

### Onset-triggered recording

```
core-input → transient-detector → buffer → filesystem (write)
```

Record only the audio segments that follow a detected onset, discarding
silence.
