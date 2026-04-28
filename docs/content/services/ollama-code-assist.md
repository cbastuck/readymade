# Ollama Code Assist

Combines an Ollama language model with a JavaScript executor to generate and run pipeline code from natural language.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/ollama-hacker` |

---

## What it does

Ollama Code Assist is a composite service that wraps two sub-services — [Ollama Prompt](./ollama.md) and [Hacker (Dangerous)](./hacker.md) — and coordinates between them. It operates in two modes:

| Mode | Behaviour |
|---|---|
| `generate` | Sends incoming pipeline data (limited to `limitDataOnGenerate` items) to the Ollama model with a code-generation prompt. The model's response is treated as JavaScript `process(params)` source. If `executeCodeAfterGeneration` is `true`, the generated code is immediately loaded into the Hacker sub-service and the service switches to `process` mode. |
| `process` | Runs the generated JavaScript against each incoming pipeline value using the Hacker sub-service. |

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"generate"` \| `"process"` | `"generate"` | Current operating mode |
| `limitDataOnGenerate` | `number` | `3` | Maximum number of input items sent to the model as context during code generation |
| `executeCodeAfterGeneration` | `boolean` | `true` | Automatically switch to `process` mode and execute the generated code once the model responds |
| `prompt` | `string` | — | Forwarded to the Ollama Prompt sub-service |
| `buffer` | `string` | — | JavaScript source to pre-load into the Hacker sub-service (bypasses generation) |

All other Ollama Prompt configuration properties (`model`, `endpoint`, `temperature`, etc.) are forwarded to the inner Ollama sub-service.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — used as context for code generation in `generate` mode; passed to the generated function in `process` mode |
| **Output** | Result of the generated `process(params)` function in `process` mode; `null` during generation |

---

## Typical use

1. Connect a data source (e.g. Timer + Fetcher).
2. Add Ollama Code Assist with a natural language prompt describing the transformation you want.
3. Let the model generate the code; the service switches to `process` mode automatically.
4. Pipeline now runs the generated transformation on every tick.
