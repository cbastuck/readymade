# Text To Speech

Synthesizes speech from text with a local open-source model — Kokoro, running in the Python runtime via kokoro-onnx or in the C++ runtime via embedded sherpa-onnx.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `text-to-speech` |
| C++ (hkp-rt) | `text-to-speech` |

Both runtimes take text in and emit a `FloatRingBuffer` of audio, so a board can
move the service between them unchanged. The hkp-rt version adds a `server`
backend (an OpenAI-compatible speech endpoint) alongside its in-process `local`
backend.

---

## What it does

Text To Speech receives a text string (or JSON `{text}` / `{prompt}`), runs it
through a Kokoro model, and emits the synthesized audio as a `FloatRingBuffer`
(mono float32, typically 24 kHz) to the next service or runtime. Everything runs
locally — no text leaves your machine.

The `{text}` input shape is deliberate: the **Text Generation** service's output
pipes straight in, completing the local voice loop
**speech-to-text → text-generation → text-to-speech**. Feed the result to an
audio-output service to hear it.

---

## Status notifications

| `status` | Meaning |
|---|---|
| `idle` | Ready; last synthesis finished |
| `loading` | Loading the model (see `detail`) |
| `generating` | Synthesis in progress |
| `error` | Something failed (input, dependency, or model) |

A facade `status-indicator` widget can bind to `path: "status"` and color-map
these values directly. On success the service also notifies audio metadata
(`voice`, `sampleRate`, `samples`, `audioMs`, `generationMs`).

---

## hkp-python

The Python runtime synthesizes with Kokoro-82M via
[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). The ML dependencies
are an optional extra:

```
pip install "hkp-python[tts]"
```

Model files (~310 MB ONNX + ~27 MB voices) download lazily on first use into
`~/.cache/hkp-python/kokoro`.

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `"kokoro-v1.0"` | `kokoro-v1.0` or `kokoro-v1.0-int8` |
| `voice` | `string` | `"af_heart"` | Kokoro voice name |
| `speed` | `number` | `1.0` | 0.5–2.0 |
| `lang` | `string` | `"en-us"` | Language |
| `modelDir` | `string` | cache dir | Where model files are stored |

Output is a `FloatRingBuffer` at 24 kHz.

---

## hkp-rt (C++ runtime)

The C++ runtime runs the same service with two backends selected by the
`backend` state:

- **`local`** (default) — a Kokoro ONNX model runs in-process via embedded
  [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). Compiled in when the
  runtime is built with `-DHKP_SPEECH_ENABLED=ON` (the default on desktop;
  off for iOS/Android, which fall back to the server backend).
- **`server`** — a thin client for an OpenAI-compatible `POST /v1/audio/speech`
  endpoint. Always available.

### Model

Download a sherpa-onnx Kokoro model and point the path keys at its files:

```
curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2 | tar xj
```

### Configuration (hkp-rt)

| Property | Type | Default | Description |
|---|---|---|---|
| `backend` | `string` | `"local"` | `local` or `server` |
| `serverUrl` | `string` | `"http://127.0.0.1:8081"` | Server backend: base URL |
| `model` | `string` | `"tts-1"` | Server backend: model name |
| `voice` | `string` | `"af_heart"` | Server backend: voice name |
| `modelPath` | `string` | `""` | Local backend: Kokoro ONNX (`~` expands) |
| `voicesPath` | `string` | `""` | Local backend: voices file |
| `tokensPath` | `string` | `""` | Local backend: tokens file |
| `dataDir` | `string` | `""` | Local backend: `espeak-ng-data` directory |
| `speakerId` | `number` | `0` | Local backend: speaker index |
| `speed` | `number` | `1.0` | 0.5–2.0 |
| `numThreads` | `number` | `2` | Local backend: inference threads |

A single `FloatRingBuffer` hop carries at most ~88200 samples (the runtime's
fixed ring-buffer size), i.e. ~3.67 s at 24 kHz; longer synthesis is truncated
to that and a `truncated` count is reported in the audio-metadata notification.

### Example (hkp-rt)

`hkp-rt/config/text-to-speech-example.json` wires `text-to-speech` (local) →
`core-output`, so a POST of text is spoken through the speakers.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `string` / `TextData`, or JSON `{ "text": string }` / `{ "prompt": string }` |
| **Output** | `FloatRingBuffer` — mono float32 audio (24 kHz for Kokoro) |

Non-text input produces `{ "error": "..." }` instead of crashing the pipeline;
a missing dependency or unavailable local backend is reported the same way.
