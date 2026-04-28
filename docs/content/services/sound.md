# Sound

Synthesises audio from note events using the Web Audio API, with synth and drum modes.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/sound` |

---

## What it does

Sound receives note events from the pipeline and plays them through the browser's Web Audio API. Two generator modes are available:

| Mode | Description |
|---|---|
| `synth` | Oscillator-based synthesis. Converts note names (e.g. `"C4"`) to Hz using standard MIDI tuning (A4 = 440 Hz). Configurable waveform and note duration. Also accepts `NoteFrame` objects from the Game of Life pipeline. |
| `drums` | Synthesises kick, snare, and hi-hat patterns using only the Web Audio API — no sample files required. Note names are mapped to drum types via `drumMap`. |

The service passes the incoming data through unchanged after triggering audio playback.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `generator.type` | `"synth"` \| `"drums"` | `"synth"` | Generator mode |
| `volume` | `number` | `1.0` | Master volume (0–1) |
| `waveType` | `string` | `"sine"` | Oscillator waveform for `synth` mode. One of `sine`, `triangle`, `square`, `sawtooth`, `organ`, `soft`, `fifth` |
| `noteDuration` | `number` | `0.2` | Note duration in seconds for `synth` mode |
| `drumMap` | `object` | `{ C4: "kick", D4: "snare", E4: "hihat" }` | Map of note name → drum type for `drums` mode |

### Custom waveforms

`organ`, `soft`, and `fifth` are custom waveforms defined by their Fourier partial coefficients, providing more complex timbres than the standard oscillator shapes.

---

## Input shapes

| Shape | Description |
|---|---|
| `{ note: "C4" }` | Single note |
| `[{ note: "C4" }, { note: "E4" }]` | Chord (multiple simultaneous notes) |
| `{ notes: [{ frequency, velocity, duration }] }` | `NoteFrame` from [Game of Life](./game-of-life.md) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Note object, array of note objects, or `NoteFrame` |
| **Output** | Pass-through (original input unchanged) |
