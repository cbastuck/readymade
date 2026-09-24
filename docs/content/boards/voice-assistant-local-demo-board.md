# Voice Assistant (local model)

The [Voice Assistant](./voice-assistant-demo-board.md) with one thing changed:
the language model runs *inside* the Python runtime instead of behind an HTTP
server. Same five services, same three runtimes, one different backend.

## What it does

Identical from the outside — record, speak, stop, hear an answer.

## What differs

Only the [Text Generation](../services/text-generation.md) service's
configuration:

| | Server backend | Local backend |
|---|---|---|
| `backend` | (default) | `local` |
| Model | whatever port 8081 serves | `~/models/Qwen3-0.6B-Q8_0.gguf` |
| Context | server's | `contextSize: 4096` |
| GPU | server's | `gpuLayers: -1` — offload everything |

The system prompt also ends in `/no_think`, which suppresses Qwen3's reasoning
block. Without it the model narrates its thinking and the assistant reads the
narration aloud.

## Which to use

The in-process backend is one fewer thing to run, and a small model like
Qwen3-0.6B loads fast enough to be practical. A separate llama-server is better
when you want a larger model, want to share it between boards, or want to
restart the board without reloading weights.

That the choice is a field on one service — rather than a different board — is
the part worth noticing.

## How it works

Unchanged from the [Voice Assistant](./voice-assistant-demo-board.md): browser
captures, Python transcribes → answers → speaks, browser plays back.

## Try it

Needs hkp-python on port 8080 with `pip install "hkp-python[asr,tts,llm]"` and a
GGUF at the configured `modelPath`.
