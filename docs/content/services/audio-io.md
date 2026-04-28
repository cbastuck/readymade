# Audio IO

Records audio from a microphone and plays it back through the speakers, in both the browser and the hkp-rt native runtime.

---

## Available in

| Runtime | Service ID | Platform |
|---|---|---|
| Browser | `hookup.to/service/audio-input` | All |
| Browser | `hookup.to/service/audio-output` | All |
| hkp-rt | `core-input` | macOS only |
| hkp-rt | `core-output` | macOS only |

---

## Browser — Audio Input

**Service ID:** `hookup.to/service/audio-input`

Requests microphone access and records audio using the browser's `MediaRecorder` API. Emits `FloatRingBuffer` chunks downstream on a configurable interval.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `timeslice` | `number` | `1000` | Recording chunk interval in milliseconds |
| `device` | `MediaDeviceInfo` | system default | Audio input device to use |

### Commands

| Action | Params | Description |
|---|---|---|
| `"start-recording"` | `{ timeslice? }` | Start capturing audio |
| `"stop-recording"` | — | Stop capturing |

### Output

A `FloatRingBuffer` containing the most recent audio chunk at the device's native sample rate.

---

## Browser — Audio Output

**Service ID:** `hookup.to/service/audio-output`

Decodes and plays back audio data received from the pipeline through the Web Audio API.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `fadeInTime` | `number` | `0` | Fade-in duration in seconds when playback starts |

### Input

A `FloatRingBuffer` or decoded audio buffer, typically from Audio Input, FFT → IFFT, or an audio synthesis pipeline.

---

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
