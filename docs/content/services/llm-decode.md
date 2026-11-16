# LLM Decode

The model's forward pass: tokens in, one score per vocabulary entry out.

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
| C++ (hkp-rt) | `llm-decode` |

Needs hkp-rt built with llama.cpp (`HKP_LLAMA_ENABLED`, on by default on
desktop).

---

## What it does

This is where the model runs. Every token is looked up, taken through all of
the model's layers, and what comes out for the last position is one score — a
*logit* — for each entry of the vocabulary: how much the model expects that
token to come next.

Nothing is chosen here. A model does not produce a word; it produces a ranking
of every word it knows, and what is done with the ranking is the
[Sample](./sample.md) services' business.

"Decode" is llama.cpp's word for the forward pass. It is not the step that
turns tokens back into text — that is [Detokenize](./detokenize.md).

### It behaves as a function, and remembers

The same tokens give the same scores. What makes real models usable is that it
keeps the work it did for the tokens it has already seen (the *KV cache*) and
runs only the new ones. In a generation [Loop](./loop.md) that is one token a
round, however long the text has become.

Tokens that begin differently from the last call's drop what no longer
applies. Change the last word of a prompt and only that word runs again;
change the first and all of it does. Each call reports how much was run:

```json
{ "decoded": 1, "reused": 31,
  "candidates": [ { "token": 6164, "piece": "Red", "p": 0.62 }, … ] }
```

`candidates` are the `top` most likely next tokens with their probabilities,
before any sampler has touched them.

It runs on the pipeline's own thread, one call at a time. A long prompt on a
large model holds that thread for as long as it takes; inside a Loop the
thread is given back between rounds.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model to run, as `hkp-asset://<id>` |
| `contextSize` | `number` | `4096` | How many tokens fit. Changing it drops what was kept |
| `top` | `number` | `10` | How many candidates each call reports |
| `clear` | `true` | — | Command: drop what was kept |
| `cached` | `number` | — | Read-only: how many tokens it holds work for |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `{ tokens, … }` as [Tokenize](./tokenize.md) hands them on |
| **Output** | scores: one float32 per vocabulary entry, with the input beside them and `applied: []` |

The scores travel as `MixedData` — about 600 KB for a vocabulary of 150,000 —
and stay inside the runtime: the samplers after it read them, and the last
sampler hands on tokens again. The weights never travel at all.

More tokens than `contextSize`, or a token that is not in the model's
vocabulary, pass nothing on and report why.

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
