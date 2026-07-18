# Speech To Text

Transcribes spoken audio to text with a local open-source Whisper model running in the Python runtime.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `speech-to-text` |

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
