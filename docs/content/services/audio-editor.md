# Audio Editor

Accumulates a rolling window of incoming audio and provides playback and editing of the recorded audio.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/audioeditor` |

---

## What it does

Audio Editor sits in an audio pipeline and accumulates every `FloatRingBuffer` that arrives into a single flat `Float32Array`. When the accumulated length exceeds `maxLength`, the oldest samples are discarded in ring-buffer fashion so the buffer always holds the most recent audio up to the configured limit.

The service does not pass the audio downstream — it accumulates and notifies its UI, which renders a waveform and allows the user to select a region and trigger playback.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `maxLength` | `number` | `2880000` | Maximum number of samples to retain (default = 60 s at 48 kHz) |
| `action` | `string` | — | `"clear"` resets the buffer; `"play"` triggers playback of a selection |
| `action: "play"` params | `{ startSample, endSample }` | — | Sample range to play back |

### Commands

| Command | Effect |
|---|---|
| `{ action: "clear" }` | Discards all accumulated audio |
| `{ action: "play", params: { startSample, endSample } }` | Plays back samples in the specified range |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `FloatRingBuffer` — passes through unchanged if not audio |
| **Output** | The original `FloatRingBuffer` (pass-through) |

---

## Typical use

Connect Audio Editor after an audio input service in a pipeline to create a live recorder with waveform display:

```
AudioInput → Audio Editor
```

The UI shows the accumulated waveform and lets the user trim and replay regions.
