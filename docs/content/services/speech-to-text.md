# Speech To Text

Transcribes spoken audio to text with a local open-source Whisper model — in the Python runtime via faster-whisper, or in the C++ runtime via embedded sherpa-onnx.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `speech-to-text` |
| C++ (hkp-rt) | `speech-to-text` |

Both runtimes consume the same `FloatRingBuffer` input and emit the same
transcript JSON, so a board can move the service between them unchanged. The
hkp-rt version adds a `server` backend (an OpenAI-compatible transcription
endpoint) alongside its in-process `local` backend.

---

## What it does

Speech To Text consumes a `FloatRingBuffer` of raw audio samples
(16 kHz mono float32), runs it through a Whisper-family model via
[faster-whisper](https://github.com/SYSTRAN/faster-whisper), and emits the
transcript as a JSON object to the next service or runtime. Everything runs
locally — no audio leaves your machine.

The natural producer is the browser **Audio Input** service in its
`pcm` output format, which captures the microphone, downsamples to
16 kHz mono, and ships the recording to the Python runtime as a
`FloatRingBuffer` over the YAS binary wire format.

---

## Prerequisites

The ML dependencies are an optional extra of hkp-python:

```
pip install "hkp-python[asr]"
```

The first transcription downloads the selected model from Hugging Face
(~250 MB for `small`); subsequent runs use the local cache. No GPU is
required — the default `int8` compute type is fast on CPU.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `"small"` | Model size: `tiny`, `base`, `small`, `medium`, `large-v3`, `distil-large-v3` |
| `language` | `string` | `"auto"` | ISO language code (e.g. `"en"`, `"de"`) or `"auto"` to detect |
| `computeType` | `string` | `"int8"` | Quantization: `int8`, `int8_float16`, `float16`, `float32` |
| `device` | `string` | `"auto"` | `auto`, `cpu`, or `cuda` |

The model loads lazily on first use and reloads when `model`, `device`,
or `computeType` change.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `FloatRingBuffer` — 16 kHz mono float32 samples |
| **Output** | `{ "text": string, "language": string, "languageProbability": number, "durationMs": number, "segments": [{ "start": number, "end": number, "text": string }] }` |

Non-audio input produces `{ "error": "..." }` instead of crashing the
pipeline; a missing `[asr]` extra is reported the same way with an
install hint.

---

## Status notifications

The service reports progress through notifications so UIs stay
observable during long operations:

| `status` | Meaning |
|---|---|
| `idle` | Ready; last transcription finished |
| `loading` | Downloading / loading the model (see `detail`) |
| `transcribing` | Inference in progress |
| `error` | Something failed (input, dependency, or model) |

A facade `status-indicator` widget can bind to `path: "status"` and
color-map these values directly.

---

## Example

The **Voice Notes** demo board wires three runtimes together —
record in the browser, transcribe in Python, display in the browser:

```json
{
  "recorder": [
    {
      "serviceId": "hookup.to/service/audio-input",
      "state": { "format": "pcm" }
    }
  ],
  "python": [
    {
      "serviceId": "speech-to-text",
      "state": { "model": "small", "language": "auto" }
    }
  ],
  "display": [
    { "serviceId": "hookup.to/service/monitor" }
  ]
}
```

Start the Python runtime (`hkp-python`, default port 8080), open the
board, hit **Record**, speak, then **Stop & Transcribe**.

---

## hkp-rt (C++ runtime)

The C++ runtime runs the same service with two backends selected by the
`backend` state:

- **`local`** (default) — a Whisper ONNX model runs in-process via embedded
  [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). Compiled in when the
  runtime is built with `-DHKP_SPEECH_ENABLED=ON` (the default on desktop;
  off for iOS/Android, which fall back to the server backend).
- **`server`** — a thin client for an OpenAI-compatible
  `POST /v1/audio/transcriptions` endpoint. Always available.

### Model

Download a sherpa-onnx Whisper model and point the three path keys at its files:

```
curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2 | tar xj
```

Use a **multilingual** model (e.g. `sherpa-onnx-whisper-tiny`), not an
English-only `.en` build — the decoder expects a language token that `.en`
models don't emit.

### Configuration (hkp-rt)

| Property | Type | Default | Description |
|---|---|---|---|
| `backend` | `string` | `"local"` | `local` or `server` |
| `serverUrl` | `string` | `"http://127.0.0.1:8081"` | Server backend: base URL |
| `model` | `string` | `"whisper-1"` | Server backend: model name |
| `encoderPath` | `string` | `""` | Local backend: Whisper encoder ONNX (`~` expands) |
| `decoderPath` | `string` | `""` | Local backend: Whisper decoder ONNX |
| `tokensPath` | `string` | `""` | Local backend: tokens file |
| `language` | `string` | `"auto"` | ISO code (e.g. `"en"`) or `"auto"` to detect |
| `numThreads` | `number` | `2` | Local backend: inference threads |
| `sampleRate` | `number` | `16000` | Rate of the incoming samples; resampled to 16 kHz internally |

A single `FloatRingBuffer` hop carries at most ~88200 samples (the runtime's
fixed ring-buffer size), i.e. ~5.5 s at 16 kHz — the service transcribes one
such utterance per call.

### Example (hkp-rt)

`hkp-rt/config/speech-to-text-example.json` wires the microphone straight into
the transcriber: `core-input` → `speech-to-text` (local) → `monitor`. It pairs
naturally with **text-generation** and **text-to-speech** to form a fully local
voice loop inside one C++ runtime.
