# Chat Template

Wraps a conversation in the control tokens a chat model was trained on, and hands on the prompt as the model reads it.

> One of five services that lay a language model out on a board:
> [Chat Template](./chat-template.md), [Tokenize](./tokenize.md),
> [LLM Decode](./llm-decode.md), [Sample](./sample.md) and
> [Detokenize](./detokenize.md), with a [Loop](./loop.md) around the last
> three. [Text Generation](./text-generation.md) does all of it in one call and
> is the service to use for getting text; these are for seeing and changing how
> text is made. The [LLM Pipeline](../boards/llm-pipeline-board.md) board is
> all five together.

---

## Available in

| Runtime | Service ID |
|---|---|
| C++ (hkp-rt) | `chat-template` |

Needs hkp-rt built with llama.cpp (`HKP_LLAMA_ENABLED`, on by default on
desktop).

---

## What it does

A chat model was trained on conversations written in one particular way: each
message wrapped in control tokens that say who is speaking. Which tokens is a
property of the model, and travels inside the model file.

```
"Name a colour."   →   <|im_start|>system
                       Answer briefly.<|im_end|>
                       <|im_start|>user
                       Name a colour.<|im_end|>
                       <|im_start|>assistant
```

That text is the whole of what the model is given. Seeing it explains things
that are otherwise mysterious: why a model answers instead of continuing your
sentence (the prompt ends where the assistant's turn begins), and why a system
prompt is just more text at the front.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model whose template is applied, as `hkp-asset://<id>` |
| `systemPrompt` | `string` | `""` | Put in front as a `system` message |
| `addAssistant` | `boolean` | `true` | End the prompt at the start of the assistant's turn |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | text (the user's message), or `{ prompt }`, `{ text }`, `{ messages: [{ role, content }] }` |
| **Output** | text: the prompt, control tokens written out |

The same input shapes as [Text Generation](./text-generation.md). With
`messages`, the roles are the caller's; `systemPrompt` still goes in front.

A model file that carries a template llama.cpp does not know passes nothing on
and reports why.

---

## The model

`model` names a board asset, `hkp-asset://<id>` — a GGUF file declared in the
board with its `url` and `sha256` ([Assets](../concepts/assets.md)). The runtime
fetches it once per server, loads it once, and hands the same model to every
service that names it, so the five services of a pipeline hold one model.

Fetching and loading happen beside the pipeline, not in it. Until the model is
there the service passes nothing on and says why:

| State | Meaning |
|---|---|
| `status` | `idle`, `fetching`, `loading`, `ready` or `error` |
| `progress` | 0 to 1 while fetching, when the source says its size |
| `fetched` | the same as text — `76%` — for a panel to show; empty when nothing is being fetched |
| `problem` | why `status` is `error` |

A build of hkp-rt without llama.cpp has the service and says in `problem` that
it cannot run.
