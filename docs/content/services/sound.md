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

All Sound instances on a page share one audio context. It is opened when the first Sound is created, not when the first note plays, because opening one blocks while the audio device starts (about 150 ms measured in Chromium). A context opened before the page has had a user gesture starts suspended, and is resumed on the first gesture anywhere on the page. It is closed a few seconds after the last Sound goes, so a pipeline rebuilt around its Sounds does not reopen the device.

A note is started the moment its input arrives. It is heard after the latency the browser reports: the context's own buffering plus the output device's. The panel shows that figure ("Heard 12 ms after playing"). A Bluetooth device typically adds far more than wired speakers.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `generator.type` | `"synth"` \| `"drums"` | `"synth"` | Generator mode |
| `volume` | `number` | `1.0` | Master volume (0–1) |
| `waveType` | `string` | `"sine"` | Oscillator waveform for `synth` mode. One of `sine`, `triangle`, `square`, `sawtooth`, `organ`, `soft`, `fifth` |
| `noteDuration` | `number` | `0.2` | Note duration in seconds for `synth` mode |
| `drumMap` | `object` | `{ C4: "kick", D4: "snare", E4: "hihat" }` | Map of note name → drum type for `drums` mode |
| `trigger` | `string` \| `null` | `null` | What to play for an input that names no note of its own, such as a Timer tick: a note name, or in `drums` mode also `"kick"`, `"snare"` or `"hihat"`. Unset, such an input plays nothing. A note the input names always wins. |

### Custom waveforms

`organ`, `soft`, and `fifth` are custom waveforms defined by their Fourier partial coefficients, providing more complex timbres than the standard oscillator shapes.

---

## Input shapes

| Shape | Description |
|---|---|
| `{ note: "C4" }` | Single note |
| `[{ note: "C4" }, { note: "E4" }]` | Chord (multiple simultaneous notes) |
| `{ notes: [{ frequency, velocity, duration }] }` | `NoteFrame` from [Game of Life](./game-of-life.md) |
| Anything else | Plays `trigger`, if one is set |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Note object, array of note objects, or `NoteFrame` |
| **Output** | Pass-through (original input unchanged) |
