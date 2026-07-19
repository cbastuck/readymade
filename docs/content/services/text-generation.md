# Text Generation

Generates text with a local large language model running in the Python runtime — via an OpenAI-compatible server or fully in-process.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `text-generation` |

---

## What it does

Text Generation takes a prompt, runs it through a locally hosted LLM, and
emits the answer as JSON to the next service or runtime. Everything runs
locally — no text leaves your machine.

Two backends are available, selected by the `backend` state:

- **`server`** (default) — the service is a thin client to any locally
  running server that speaks the OpenAI chat-completions API
  (`llama-server`, Ollama, vLLM, LM Studio, ...). Use this for quants that
  need a custom llama.cpp build, such as the 1-bit Bonsai 27B reference
  model via the PrismML fork.
- **`local`** — the service loads a standard GGUF (Qwen, Llama, Mistral, ...)
  directly into the Python runtime via `llama-cpp-python`. No external
  server process is needed.

The natural producer is the **Speech To Text** service — its output JSON
carries a `text` key that pipes straight in — and the natural consumer is
**Text To Speech**, completing a fully local voice loop.

---

## Prerequisites

**Server backend** — no extra Python dependencies; start any
OpenAI-compatible server, e.g.:

```
llama-server -m Bonsai-27B-Q1_0.gguf --port 8081 -ngl 99
```

**Local backend** — the in-process engine is an optional extra of hkp-python:

```
pip install "hkp-python[llm]"
```

plus a GGUF file on disk (e.g. `Qwen3-0.6B-Q8_0.gguf` from Hugging Face).

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `backend` | `string` | `"server"` | `server` (OpenAI-compatible HTTP) or `local` (in-process GGUF) |
| `serverUrl` | `string` | `"http://127.0.0.1:8081"` | Server backend: base URL of the OpenAI-compatible server |
| `model` | `string` | `""` | Server backend: optional model name passed through to the server |
| `modelPath` | `string` | `""` | Local backend: path to the `.gguf` file (`~` expands) |
| `contextSize` | `number` | `4096` | Local backend: context window in tokens |
| `gpuLayers` | `number` | `-1` | Local backend: layers to offload to GPU (`-1` = all) |
| `systemPrompt` | `string` | `"You are a helpful assistant"` | Prepended when the input has no system message |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `topP` | `number` | `0.95` | Nucleus sampling |
| `topK` | `number` | `20` | Top-k sampling |
| `maxTokens` | `number` | `512` | Completion token budget |
| `timeoutSec` | `number` | `300` | Server backend: request timeout |
| `thinking` | `bool\|null` | `null` | Server backend (llama-server only): force thinking on/off; `null` sends nothing |
| `stream` | `bool` | `true` | Generate token by token and notify the growing text as `{streamText}` (final notification carries `streamDone: true`) for live chat-bot-style display; the pipeline output is unaffected and still emitted once, when generation finishes. Set `false` for servers without SSE support |

In local mode the model loads lazily on first use and reloads when
`modelPath`, `contextSize`, or `gpuLayers` change. For thinking models in
local mode, add `/no_think` to the system prompt to suppress reasoning
(the `thinking` toggle is a llama-server chat-template extension).

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `String` prompt, or JSON with `prompt`, `text`, or a full `messages` array |
| **Output** | `{ "text": string, "thinking"?: string, "model": string, "durationMs": number, "usage": { "promptTokens": number, "completionTokens": number } }` |

For thinking models the reasoning is split off into the `thinking` field;
`text` carries only the answer. Unsupported input, an unreachable server,
or a missing `[llm]` extra produce `{ "error": "..." }` with a hint instead
of crashing the pipeline.

---

## Status notifications

| `status` | Meaning |
|---|---|
| `idle` | Ready; last generation finished |
| `loading` | Local backend: loading the GGUF (see `detail`) |
| `generating` | Inference in progress |
| `error` | Something failed (input, backend, or model) |

A facade `status-indicator` widget can bind to `path: "status"` and
color-map these values directly.

---

## Example

The attached demo board uses the server backend (Injector → text-generation
→ monitor). A local-backend variant that needs no external server lives at
`boards/text-generation-local-demo-board.json` — it loads
`Qwen3-0.6B-Q8_0.gguf` in-process:

```json
{
  "python": [
    {
      "serviceId": "text-generation",
      "state": {
        "backend": "local",
        "modelPath": "~/models/Qwen3-0.6B-Q8_0.gguf",
        "systemPrompt": "You are a helpful assistant. /no_think"
      }
    },
    { "serviceId": "monitor" }
  ]
}
```

Start the Python runtime (`hkp-python`, default port 8080), open the board,
and inject a prompt.
