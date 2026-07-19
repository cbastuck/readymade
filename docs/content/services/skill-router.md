# Skill Router

Matches free-form text — e.g. a voice transcript — against a configured set of skills with a local LLM and dispatches the matched skill's board with extracted parameters.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `skill-router` |

---

## What it does

Skill Router takes a request in natural language, asks a locally hosted LLM
which configured skill it matches, extracts the skill's parameters from the
request, and emits `{ "board": ..., "payload": ... }`. A browser
**Board-Service** in `input` board-source mode then plays that saved board
with the payload. Everything runs locally.

A skill is described declaratively:

```json
{
  "action": "send notification",
  "board": "send ntfy",
  "payload": { "topic": "the ntfy topic", "message": "the message text" }
}
```

The payload template's keys are the parameter names; its values describe to
the model what to extract from the request.

On a match the routing decision is final: the result is early-returned,
skipping any services after the router in the same runtime. The `noMatch`
config decides the other branch: `stop` (default) ends the pipeline,
`forward` passes the original input on to the remaining services — e.g. a
**Text Generation** fallback that answers requests no skill covers.

The same two LLM backends as Text Generation are available, selected by the
`backend` state: `server` (default, any OpenAI-compatible local server) or
`local` (in-process GGUF via `llama-cpp-python`).

---

## Live visibility

The service has a dedicated UI panel built around a single **process view**
that shows each routing run end to end as it happens:

- the composed **prompt** (system instructions + skills + request),
- the **model output** as it is being generated, chat-bot style (the
  service consumes the model stream token by token — `stream` state,
  default on — and notifies the growing text as `{streamText}`),
- the final **decision** — matched action, target board, extracted payload —
  or "no match".

The pipeline output is unaffected by streaming: the routing decision is
still emitted once, when generation finishes. Set `stream: false` for
servers that do not support server-sent events; the process view then
shows the output once it is complete.

The panel also contains a **visual skill editor**: each skill shows as a
compact card (action, target board, parameter names). Clicking a card — or
**Add Skill** — opens an edit dialog with `action` and `board` input fields
and a JSON editor for the payload template. **Apply** validates the entry,
reconfigures the router, and closes the dialog; **Delete** removes the
skill; closing the dialog discards the draft.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `skills` | `array` | `[]` | Skills as `{action, board, payload}`; malformed entries are dropped |
| `noMatch` | `string` | `"stop"` | `stop` ends the pipeline; `forward` passes the input to the services after the router |
| `stream` | `bool` | `true` | Stream the model output token by token into the UI |
| `backend` | `string` | `"server"` | `server` (OpenAI-compatible HTTP) or `local` (in-process GGUF) |
| `serverUrl` | `string` | `"http://127.0.0.1:8081"` | Server backend: base URL of the OpenAI-compatible server |
| `model` | `string` | `""` | Server backend: optional model name passed through to the server |
| `modelPath` | `string` | `""` | Local backend: path to the `.gguf` file (`~` expands) |
| `contextSize` | `number` | `4096` | Local backend: context window in tokens |
| `gpuLayers` | `number` | `-1` | Local backend: layers to offload to GPU (`-1` = all) |
| `temperature` | `number` | `0.1` | Sampling temperature (routing wants determinism) |
| `maxTokens` | `number` | `256` | Completion token budget |
| `timeoutSec` | `number` | `120` | Server backend: request timeout |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `String` request, or JSON with `text` or `prompt` (the Speech To Text output pipes straight in) |
| **Output** | Match: `{ "board": string, "payload": object }` (early-returned). No match: pipeline stops, or the original input is forwarded (`noMatch: "forward"`) |

Only parameters the skill declares are kept in the payload; extra fields
the model invents are filtered out. Backend errors produce
`{ "error": "..." }` with a hint instead of crashing the pipeline.

---

## Notifications

| Key | Meaning |
|---|---|
| `status` | `idle`, `loading` (local model load), `routing`, `error` |
| `lastRequest`, `lastPrompt` | The request text and the composed chat messages |
| `streamText` | The model output accumulated so far (`streamDone: true` on the last one) |
| `lastOutput` | The complete model output, thinking stripped |
| `matched` | Final decision: the matched action (with `board`, `payload`, `durationMs`) or `null` |

`lastRequest`, `lastPrompt`, `lastOutput`, and `lastMatch` are also part of
the service state, so the panel restores the most recent run when reopened.

---

## Example

`boards/voice-assistant-skills-local-demo-board.json` wires the full loop:
speech-to-text → skill-router (with a text-generation fallback via
`noMatch: "forward"`) → board dispatch. A minimal text-only version:

```json
{
  "python": [
    {
      "serviceId": "skill-router",
      "state": {
        "backend": "local",
        "modelPath": "~/models/Qwen3-0.6B-Q8_0.gguf",
        "skills": [
          {
            "action": "send notification",
            "board": "send ntfy",
            "payload": { "topic": "the ntfy topic", "message": "the message text" }
          }
        ]
      }
    }
  ],
  "ui": [
    { "serviceId": "hookup.to/service/board", "state": { "boardSource": "input" } }
  ]
}
```

Start the Python runtime (`hkp-python`, default port 8080), open the board,
and inject a request like *"send a notification to topic home saying dinner
is ready"*.
