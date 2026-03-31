# Ollama

Sends a prompt to a local Ollama instance and streams the generated response into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/ollama-prompt` |

---

## What it does

OllamaPrompt connects to a locally running [Ollama](https://ollama.ai)
server, sends a configured prompt (optionally composed with data from the
upstream pipeline), and streams or returns the model's response as the
next pipeline value.

---

## Prerequisites

An Ollama server must be running and accessible at the configured
`endpoint` (default: `http://localhost:11434/api`). At least one model
must be pulled (`ollama pull llama3` etc.).

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `"http://localhost:11434/api"` | Base URL of the Ollama API |
| `model` | `string` | `""` | Model name to use (e.g. `"llama3"`, `"mistral"`) |
| `prompt` | `string` | `""` | Prompt template sent to the model |
| `temperature` | `number` | `0` | Sampling temperature (0 = deterministic) |
| `seed` | `number` | `0` | Random seed for reproducibility |
| `responseIsJson` | `boolean` | `false` | Parse the response as JSON before emitting |

### Dynamic prompt composition

The `prompt` field can reference upstream pipeline data using standard
JavaScript template literal syntax or by composing a string in a
preceding [Map](./map.md) service:

```
Classify the following text: {{params.text}}
```

The upstream pipeline value's fields are available as context when the
prompt is processed.

### `responseIsJson`

When `true`, the model's response is parsed with `JSON.parse()` before
being emitted. Use this when the model is prompted to return structured
data. If parsing fails the raw string is emitted as a fallback.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — can be incorporated into the prompt template |
| **Output** | Model response as a `string`, or as a parsed JSON object if `responseIsJson: true` |

---

## Available models (read-only)

The service fetches the list of locally available models from
`{endpoint}/tags` and exposes them as `availableModels` in its state.
This list is shown in the UI's model selector.

---

## Example

Summarise each article fetched from an RSS feed:

```json
[
  {
    "serviceId": "hookup.to/service/fetcher",
    "state": { "url": "https://example.com/feed.json" }
  },
  {
    "serviceId": "hookup.to/service/ollama-prompt",
    "state": {
      "model": "llama3",
      "prompt": "Summarise this article in one sentence: ",
      "temperature": 0.3,
      "responseIsJson": false
    }
  },
  {
    "serviceId": "hookup.to/service/monitor",
    "state": {}
  }
]
```
