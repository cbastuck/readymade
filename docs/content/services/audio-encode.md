# Audio Encode

Turns the samples a board made into a file a board can keep.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `audio-encode` |

---

## What it does

Services that produce sound produce **samples**: a `FloatRingBuffer` is what
[Text To Speech](./text-to-speech.md), a microphone and a synthesiser all hand
on, and what Audio Output plays. Samples are not a file — nothing stores them,
serves them, or hands them to a player. This encodes them.

It emits **bare bytes**: not bytes with a name, not bytes with a content type.
What they are called belongs to whatever keeps them — [Storage](./storage.md)
reads the file extension, and an endpoint reads what Storage says. An encoder
that also decided names would have to be told about both.

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `format` | `"mp3" \| "wav"` | `mp3` | What to write |
| `bitrate` | `number` | `64` | kbit/s, mp3 only |
| `quality` | `number` | `5` | LAME quality, 0 (best) to 9 |
| `sampleRate` | `number` | `24000` | What the incoming samples are |
| `channels` | `1 \| 2` | `1` | How to read them |

`wav` needs nothing beyond the standard library and is always available. `mp3`
is an optional extra:

```
pip install "hkp-python[mp3]"
```

A board that only plays audio back has no reason to carry an encoder, which is
why it is an extra; the two formats are one service because choosing between
them is a decision about size against fidelity, not a different job.

### The sample rate is configuration

A `FloatRingBuffer` carries floats and does not say how fast they were meant to
be played, so the same samples are a different length of audio depending on what
a board says they are. Kokoro synthesises at 24 kHz, which is why that is the
default here and in Audio Output.

## Input / Output

| | Shape |
|---|---|
| **Input** | `FloatRingBuffer` |
| **Output** | the encoded bytes |

Samples outside -1..1 are clipped rather than the clip being quietened to
accommodate them: a sample that loud was already wrong when it was made, and
scaling would change audio that was correct.

Anything that is not audio comes back as `{ error }` and is reported in the
service's state, rather than being encoded into noise.

## Example

Reading text aloud and keeping the result, as the Radio boards do:

```
map (the words) → text-to-speech → audio-encode → … → storage
```

## Demo board

`audio-encode-demo-board.json` — type a line, hear what it costs as an mp3.

## See also

- [Text To Speech](./text-to-speech.md) — where the samples usually come from
- [Storage](./storage.md) — where the bytes usually go
