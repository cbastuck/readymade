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
| `synth` | Oscillator-based synthesis. Converts note names (e.g. `"C4"`) to Hz using standard MIDI tuning (A4 = 440 Hz). Configurable waveform and envelope (see *Envelope*). Also accepts `NoteFrame` objects from the Game of Life pipeline. |
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
| `noteDuration` | `number` | `0.3` | How long a `synth` note is held before its release, in `noteDurationUnit` |
| `noteDurationUnit` | `"s"` \| `"beats"` | `"s"` | Seconds, or beats of a tempo (see *Envelope*) |
| `attack` | `number` | `0.01` | Seconds a `synth` note takes to rise to full volume |
| `release` | `number` | `0.03` | Seconds a `synth` note takes to fade once it is no longer held |
| `tempoSlot` | `string` | `"tempo"` | The slot a tempo in BPM is read from when the input carries none |
| `drumMap` | `object` | `{ C4: "kick", D4: "snare", E4: "hihat" }` | Map of note name → drum type for `drums` mode |
| `trigger` | `string` \| `null` | `null` | What to play for an input that names no note of its own, such as a Timer tick: a note name, or in `drums` mode also `"kick"`, `"snare"` or `"hihat"`. Unset, such an input plays nothing. A note the input names always wins. |

### Envelope

A `synth` note rises from silence to full volume over `attack`, is held until
`noteDuration` has passed since it started, and then fades out over `release`.
The release comes after the note, so a long one carries it into whatever is
played next: a pad is a slow attack, a note held for the length of its chord
and a long release. A note let go before its attack is over fades from where it
got to.

With `noteDurationUnit` `"beats"` the note is held for beats of a tempo, read
as each note starts. The tempo is the input's `tempo` where it carries one (a
[Timeline](./timeline.md) counting beats puts it on every frame), otherwise
the one held in the slot `tempoSlot` names, as [Timer](./timer.md#beats) reads
it, and 120 BPM when there is neither. A Sound inside a
[Tracks](./tracks.md) track cannot see the slots around it, so there the tempo
has to come with the input.

### Custom waveforms

`organ`, `soft`, and `fifth` are custom waveforms defined by their Fourier partial coefficients, providing more complex timbres than the standard oscillator shapes.

---

## Input shapes

| Shape | Description |
|---|---|
| `{ note: "C4" }` | Single note |
| `[{ note: "C4" }, { note: "E4" }]` | Chord (multiple simultaneous notes) |
| `{ notes: [{ note: "C4" }, …], tempo? }` | Chord, held in beats of the `tempo` it carries |
| `{ notes: [{ frequency, velocity, duration }] }` | `NoteFrame` from [Game of Life](./game-of-life.md) (`synth` only) |
| Anything else | Plays `trigger`, if one is set |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Note object, array of note objects, or `NoteFrame` |
| **Output** | Pass-through (original input unchanged) |
