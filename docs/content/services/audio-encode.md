# Audio Encode

Turns the samples a board made into a file a board can keep.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `audio-encode` |
| C++ (hkp-rt) | `audio-encode` |

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
| `stream` | `boolean` | `false` | One recording across all passes rather than one per pass — hkp-rt, mp3 only |

`wav` needs nothing beyond the standard library and is always available. `mp3`
is an optional extra on hkp-python:

```
pip install "hkp-python[mp3]"
```

and compiled into hkp-rt with LAME (`HKP_MP3_ENABLED`, on for macOS builds). A
runtime without it lists only `wav` in `availableFormats`.

A board that only plays audio back has no reason to carry an encoder, which is
why it is an extra; the two formats are one service because choosing between
them is a decision about size against fidelity, not a different job.

### The sample rate is configuration

A `FloatRingBuffer` carries floats and does not say how fast they were meant to
be played, so the same samples are a different length of audio depending on what
a board says they are. Kokoro synthesises at 24 kHz, which is why that is the
default here and in Audio Output.

### Streaming

Without `stream`, each pass is a whole recording: the input is encoded and the
encoder flushed, and what comes out is a complete file.

With it, the passes are **one recording that never ends**. A single encoder lives
across all of them; each pass hands it whatever samples arrived since the last
and emits the frames that finished — often none, in which case the pass stops
there. Nothing is flushed until a setting changes, which starts a new stream.

That is what MP3 needs. Frames are not independent: each overlaps its neighbours,
and may spend bits its predecessors saved, so the encoder keeps back the samples
its model still needs. Encoding chunk by chunk with a fresh encoder would put a
seam, and the encoder's start-up delay, into every chunk.

Every chunk a stream emits is **whole frames**, so each is a place a listener can
start — which is what lets an [endpoint's stream](./http.md#streaming) take
listeners at any moment. State adds `streamedBytes` and `streamedSeconds`, and is
notified about once a second rather than on every pass.

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

`live-radio-demo-board.json` — the microphone streamed live as MP3 from hkp-rt.

## See also

- [Text To Speech](./text-to-speech.md) — where the samples usually come from
- [Storage](./storage.md) — where the bytes usually go
