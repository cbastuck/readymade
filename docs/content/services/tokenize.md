# Tokenize

Cuts text into the tokens a model reads.

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
| C++ (hkp-rt) | `tokenize` |

Needs hkp-rt built with llama.cpp (`HKP_LLAMA_ENABLED`, on by default on
desktop).

---

## What it does

A model does not read characters. Its vocabulary is a fixed list of pieces —
whole words, parts of words, single bytes, control tokens — and text is cut
into pieces from that list.

```
"Name three colours"   →   tokens  [675, 2326, 26432]
                           pieces  ["Name", " three", " colours"]
```

`tokens` is what the model is given. `pieces` shows where the cuts fell, and
they are often surprising: a space belongs to the word after it, a rare word is
several tokens, and a number may be cut digit by digit.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model whose vocabulary is used, as `hkp-asset://<id>` |
| `addSpecial` | `boolean` | `true` | Put the model's beginning-of-text token in front, where the model wants one |
| `parseSpecial` | `boolean` | `true` | Read a control token written out in the text (`<|im_start|>`) as the one token it is |

`parseSpecial` is what a [Chat Template](./chat-template.md)'s output needs.
Turn it off and the same control token is cut up like any other text — a quick
way to see that a control token is one entry of the vocabulary, not a
spelling.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | text, or `{ text }`, `{ prompt }` |
| **Output** | `{ tokens: [id…], pieces: [text…], promptTokens }` |

`promptTokens` is how many tokens there are. It travels with the value so
that, once a [Loop](./loop.md) has appended to it, what was generated can be
told from what was asked.

Each call reports `{ count, pieces }`.

A piece is one token shown on its own. A character of more than one byte may
be split between two tokens; each half then shows as `�`.

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
| `problem` | why `status` is `error` |

A build of hkp-rt without llama.cpp has the service and says in `problem` that
it cannot run.
