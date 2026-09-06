# Text Generation

Generates text with a large language model — a local one via an OpenAI-compatible server or in-process, or a hosted one.

---

## Available in

| Runtime | Service ID | Backends |
|---|---|---|
| Python (hkp-python) | `text-generation` | `server`, `local` |
| C++ (hkp-rt) | `text-generation` | `server`, `local` |
| Node.js (hkp-node) | `text-generation` | `server`, `anthropic` |

All three expose the same state keys, the same input shapes, and the same
output JSON, so a board can move the service between them unchanged. Which
backends a runtime offers differs: every runtime can talk to a **server**,
hkp-python and hkp-rt can additionally load a GGUF **in-process**, and hkp-node
can additionally call a **hosted API**.

---

## What it does

Text Generation takes a prompt, runs it through an LLM, and emits the answer as
JSON to the next service or runtime.

On **hkp-python** and **hkp-rt** everything runs locally — no text leaves your
machine — through one of two backends selected by the `backend` state:

- **`server`** (default) — the service is a thin client to any locally
  running server that speaks the OpenAI chat-completions API
  (`llama-server`, Ollama, vLLM, LM Studio, ...). Use this for quants that
  need a custom llama.cpp build, such as the 1-bit Bonsai 27B reference
  model via the PrismML fork.
- **`local`** — the service loads a standard GGUF (Qwen, Llama, Mistral, ...)
  directly into the runtime process — via `llama-cpp-python` in hkp-python,
  via embedded llama.cpp in hkp-rt. No external server process is needed.

**hkp-node** offers `server` and, instead of `local`, **`anthropic`**: a hosted
Claude model, reached over the network. Text does leave the machine, and in
exchange the service needs no model on disk, no GPU, and no server process —
which is what makes it the one that works on a board deployed to a coordinator
with nobody watching. It also adds images in the input and extended reasoning,
which the local backends have no equivalent for.

Node cannot load a GGUF in-process the way the other two can, which is why it
has no `local`. On this runtime, local means a server next door — the same
`server` backend, pointed at `127.0.0.1`. A board therefore moves between a
model on your desk and a hosted one by changing two fields:

```json
{ "backend": "server",    "serverUrl": "http://127.0.0.1:8081", "model": "qwen3-0.6b" }
{ "backend": "anthropic", "model": "claude-sonnet-5" }
```

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

**Local backend (hkp-python)** — the in-process engine is an optional extra:

```
pip install "hkp-python[llm]"
```

**Local backend (hkp-rt)** — llama.cpp is embedded at build time. It is on by
default on macOS, Linux, and Windows, and off for iOS and Android builds, which
would otherwise pay its compile time and binary size:

```
cmake -B build -DHKP_LLAMA_ENABLED=ON ..
```

On Apple silicon the Metal shaders are embedded in the binary, so nothing has
to sit next to the runtime at load time. When the flag is off the service still
loads and the server backend still works; only `backend: "local"` reports that
it was not compiled in.

Either way you also need a GGUF file on disk (e.g. `Qwen3-0.6B-Q8_0.gguf` from
Hugging Face).

**Anthropic backend (hkp-node)** — an API key, and nothing else. The service
looks in two places: its own `apiKey`, then `ANTHROPIC_API_KEY` in the
environment the runtime starts in.

```
ANTHROPIC_API_KEY=sk-ant-... npm start
```

`apiKey` is write-only — the service accepts it and never gives it back, the
same way `smtp-email` treats its password — but a key typed straight into it is
still a credential inside the board, and a board can be downloaded, shared as a
link, or sent through the AI Refiner. A key in the environment is in none of
those places, which is why it is the one to prefer for anything deployed.

### A secret reference, in the Readymade app

Boards run in the app rarely have an environment to put anything in, and the
app has its own store for exactly this. Add the key under **Settings →
Secrets** with a name of your choosing, and refer to it from the board by that
name instead of pasting the value:

```json
{ "backend": "anthropic", "model": "claude-sonnet-5", "apiKey": "{{secret.anthropic}}" }
```

The board says *which* secret the field needs and never what it is. The value
is substituted in as the board loads, before any service is configured — so it
reaches `apiKey` the same way a typed one does, and the file on disk still
holds no credential and stays safe to save, share, or hand to the AI Refiner.
The store is the app's own (`~/.hkp/vault.json` on desktop) and the settings
dialog only ever lists names, never values. The browser playground has no such
store, so a board opened there — or anywhere the secret is not configured —
loads with the field unset and names the alias it was missing.

References work in any service field on any runtime — `smtp-email`'s password,
an `http-client` header — not just this one.

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
| `thinking` | `bool\|null` | `null` | Server backend: force thinking on/off, for a server whose chat template takes the flag; `null` sends nothing |
| `stream` | `bool` | `true` | Generate token by token and notify the growing text as `{streamText}` (final notification carries `streamDone: true`) for live chat-bot-style display; the pipeline output is unaffected and still emitted once, when generation finishes. Set `false` for servers without SSE support |

In local mode the model loads lazily on first use and reloads when
`modelPath`, `contextSize`, or `gpuLayers` change. For thinking models in
local mode, add `/no_think` to the system prompt to suppress reasoning
(the `thinking` toggle is a llama-server chat-template extension).

### hkp-node

Alongside `systemPrompt`, `temperature`, `topP`, `topK`, `maxTokens`,
`timeoutSec` and `stream`, which mean what they mean everywhere else:

| Property | Type | Default | Description |
|---|---|---|---|
| `backend` | `string` | `"anthropic"` | `anthropic` (hosted) or `server` (OpenAI-compatible HTTP) |
| `apiKey` | `string` | `""` | Write-only; takes a `{{secret.…}}` reference, and falls back to `ANTHROPIC_API_KEY` in the runtime's environment |
| `apiKeyConfigured` | `bool` | — | Read-only: whether a key is available, from either source |
| `serverUrl` | `string` | `""` | Empty means the backend's own address; set it for a proxy, or for a hosted OpenAI-compatible endpoint |
| `endpoint` | `string` | — | Read-only: the URL this configuration actually reaches |
| `model` | `string` | `"claude-sonnet-5"` | Any model the API accepts |
| `thinking` | `bool\|null` | `null` | `true` turns on extended reasoning, reported in `thinking` |
| `thinkingBudgetTokens` | `number` | `1024` | Tokens reasoning may use; `maxTokens` is lifted above it when it is not already |
| `jsonSchema` | `object\|string\|null` | `null` | Constrains the answer to a shape — see below |

**One address field, for both backends.** `serverUrl` left empty means "wherever
this backend lives" — `https://api.anthropic.com` or `http://127.0.0.1:8081` —
and the default is resolved when the request is made rather than written into
the board, so switching backends carries nothing stale across. Set it to point
at a proxy, or at a hosted OpenAI-compatible endpoint. `endpoint` reports where
a configuration actually reaches, including the API version, which is the one
question the address alone does not answer:

```json
{ "backend": "server", "serverUrl": "https://inference.example.com/api/v1" }
→ endpoint: "https://inference.example.com/api/v1/chat/completions"
```

A base URL already carrying a version keeps it; a bare origin gets `/v1` added,
because that is how the two kinds of server hand their address out.

One difference between the backends is deliberate and worth stating: **the
`ANTHROPIC_API_KEY` fallback does not apply on `server`.** That key belongs to
the hosted API, and a board naming its own address would otherwise hand the
credential to whatever is listening at it. A server that does want a token gets
the configured `apiKey` as a bearer.

**A reasoning model needs `thinking: false` to answer inside a schema.** Qwen3
and its relatives reason before answering by default, and a `jsonSchema`
constrains output from the first token — leaving nowhere to reason. What comes
back is a well-formed response that spent its whole `maxTokens` budget and
carries no answer. Setting `thinking: false` sends
`chat_template_kwargs: {enable_thinking: false}`, which those templates honour;
raising `maxTokens` works too, more slowly. A generation that produces neither
text nor `json` is reported as a failure and stops the pipeline rather than
being passed on, so a board that settles its work at the end cannot mark an
item done having produced nothing.

Two behaviours worth knowing:

- **`thinking: true` fixes sampling.** `temperature`, `topP` and `topK` are not
  sent while reasoning, because the API rejects a request that carries them.
- **`jsonSchema` turns streaming off** for that call. A constrained answer
  arrives as arguments rather than prose, and half of a JSON object is of no
  use to anything.

---

## Constrained output

Set `jsonSchema` to a JSON Schema and the answer comes back in that shape. The
parsed object is emitted as `json`, and `text` carries the same object
serialized, so a board that only knows the shared output contract still has
something to route.

Available on hkp-node, on either of its backends.

```json
{
  "serviceId": "text-generation",
  "state": {
    "systemPrompt": "Extract the booking request. Leave a field out when the message does not state it — never guess.",
    "jsonSchema": {
      "type": "object",
      "properties": {
        "hotel": { "type": "string" },
        "rooms": { "type": "integer" },
        "arrival": { "type": "string", "description": "ISO date" }
      },
      "required": ["hotel", "rooms"]
    }
  }
}
```

How the schema is sent depends on the backend, and so does how much it
guarantees:

| Backend | Sent as | Guarantee |
|---|---|---|
| `anthropic` | a single tool the model is required to call | the shape is enforced by the API |
| `server` | `response_format: { type: "json_schema" }` | enforced by servers that implement it — llama.cpp compiles the schema to a grammar |

Not every OpenAI-compatible server implements `response_format`, and one that
does not answers in prose while reporting nothing unusual. When that happens
the answer is still handed on with `text` set and `json` absent, and the
runtime logs a `service.degraded` warning naming the likely cause — so a board
sees what came back rather than an empty result it has to guess about.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `String` prompt, or JSON with `prompt`, `text`, or a full `messages` array |
| **Output** | `{ "text": string, "json"?: any, "thinking"?: string, "model": string, "durationMs": number, "usage": { "promptTokens": number, "completionTokens": number } }` |

The `anthropic` backend also reads **images** out of the input, so a scan or a
photo that arrived from `http-client`, an email attachment, or a `file-pick`
widget can be asked about directly:

| Input carries | Becomes |
|---|---|
| `{ meta: { contentType: "image/png" }, binary }` — what `http-client` and `http-server-subservices` produce | one image, plus `prompt`/`text` as the question |
| `{ images: [{ contentType, data }, ...] }` — `data` as bytes or base64 | one part each |

Images are placed before the question, which is how the model reads them best.

**On the node runtime the answer is pushed, not returned.** Generation takes
seconds, and the pipeline does not wait — so the service returns nothing, stops
the push, and calls the rest of the pipeline itself once the answer arrives (the
inversion-of-control path `http-client` also takes). For a board this is
invisible: the services after it run with the result, as they would anyway.

For thinking models the reasoning is split off into the `thinking` field;
`text` carries only the answer. Unsupported input, an unreachable server,
or a local backend that is unavailable produce `{ "error": "..." }` with a
hint instead of crashing the pipeline.

In `local` mode `model` reports the GGUF path rather than a server-assigned
model name. Streamed `streamText` notifications carry the raw model output, so
for a thinking model the live view briefly shows the `<think>` block; the final
result always has it split into `thinking`.

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

For hkp-rt the equivalent runtime config ships as
`hkp-rt/config/text-generation-example.json`:

```
./build/hkp-rt/exe/Debug/hkp-rt 5556 127.0.0.1 hkp-rt/config/text-generation-example.json
curl -X POST http://127.0.0.1:5556/runtimes/text-generation-example \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Name three primary colors."}'
```

For the Anthropic backend, `boards/text-generation-anthropic-demo-board.json`
turns a booking enquiry into structured fields (Injector → text-generation with
a `jsonSchema` → monitor). Start hkp-node with a key in its environment and
inject the message:

```
ANTHROPIC_API_KEY=sk-ant-... npm start --prefix hkp-node
```

In the Readymade app, where there is no such environment, store the key under
Settings → Secrets and set the service's `apiKey` to `{{secret.anthropic}}`
instead.

The monitor shows the extracted object, not prose — which is what makes the
next service in a board able to act on it.
