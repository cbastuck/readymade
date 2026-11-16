# Detokenize

Turns tokens back into text, and says whether the model has ended its turn.

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
| C++ (hkp-rt) | `detokenize` |

Needs hkp-rt built with llama.cpp (`HKP_LLAMA_ENABLED`, on by default on
desktop).

---

## What it does

The last step of a round. It takes the tokens — the prompt and whatever has
been appended to it — and adds what a person, and a [Loop](./loop.md), need
to know about them:

| Field | What it is |
|---|---|
| `text` | what has been generated so far: the tokens after the prompt, control tokens left out |
| `end` | whether the last token is one the model ends its turn with |
| `pieces` | every token as text, so the whole sequence can be shown with its cuts |

`end` is what a Loop around it asks its condition of: `"until": "params.end"`.
A model does not stop; it emits a token that means *I am done*, and something
outside it has to notice.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model whose vocabulary the tokens are from, as `hkp-asset://<id>` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `{ tokens, promptTokens? }` |
| **Output** | the input, with `pieces`, `text` and `end` |

Without `promptTokens` every token counts as generated, and `text` is all of
them.

A piece is one token on its own, so a character spread over two tokens shows
as `�` twice there and whole in `text`.

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
