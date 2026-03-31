# Audio IO

Captures audio from the system microphone (core-input) or plays audio to the system speakers (core-output) via CoreAudio.

---

## Available in

| Runtime | Service ID | Platform |
|---|---|---|
| hkp-rt | `core-input` | macOS only |
| hkp-rt | `core-output` | macOS only |

These services require a running hkp-rt instance on macOS. They are not
available in the browser runtime or on other operating systems.

---

## core-input

### What it does

Opens the system's default audio input device (microphone or aggregate
device) via CoreAudio and continuously captures audio samples. Captured
samples are written into a **ring-buffer** that is emitted downstream on
each callback, making `core-input` the natural source for any audio
processing pipeline.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `preferredInputDeviceName` | `string` | `""` | Name of the desired input device. If empty or not found, the system default is used. |
| `deferPropagation` | `boolean` | `false` | When `true`, captured data is not forwarded downstream until explicitly triggered |

The `configure` response includes read-only fields populated by the
service:

| Field | Type | Description |
|---|---|---|
| `currentDeviceName` | `string` | Name of the device actually opened |
| `availableDevices` | `string[]` | All input devices currently visible to CoreAudio |

### Output

A **ring-buffer** data value containing the most recent block of float32
audio samples at the device's native sample rate. The block size is
determined by the CoreAudio buffer size (a system constant).

---

## core-output

### What it does

Accepts a sample array or ring-buffer from upstream and plays it through
the system's default audio output device via CoreAudio.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `preferredOutputDeviceName` | `string` | `""` | Name of the desired output device |

### Input

A float array or ring-buffer of audio samples, typically produced by
`ifft` or a synthesis pipeline.

---

## Typical pipelines

### Microphone monitoring (passthrough)

```
core-input → core-output
```

### Real-time spectrum analysis

```
core-input → fft → monitor
```

### Live frequency-domain effect

```
core-input → fft → map (modify spectrum) → ifft → core-output
```

### Onset/beat detection

```
core-input → transient-detector → timer (trigger) → canvas
```
