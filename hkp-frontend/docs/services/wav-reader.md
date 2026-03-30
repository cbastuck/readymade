*Reads a WAV audio file from disk and emits its samples as a float array.*

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `wav-reader` |

Requires an hkp-rt instance with file system access. Not available in the
browser runtime.

---

## What it does

WAV Reader opens a WAV file at a configured path, decodes it, and emits
the audio samples as an array of floating-point values. The samples are
normalised to the range `[-1.0, 1.0]`.

The service can operate in one-shot mode (emit all samples once) or
streaming mode (emit samples in blocks suitable for downstream processing
services such as FFT).

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `path` | `string` | Absolute or relative path to the `.wav` file on the server |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (trigger to start reading) |
| **Output** | Array of `float` samples in `[-1.0, 1.0]`, or a ring-buffer compatible with audio processing services |

---

## Typical use

### Offline spectrum analysis

```
wav-reader → fft → monitor
```

Feed a WAV file through FFT to visualise its frequency content without
a live microphone.

### Audio processing chain

```
timer (trigger) → wav-reader → fft → map → ifft → core-output
```

Apply frequency-domain effects to a pre-recorded file and play the
result through the system speakers.
