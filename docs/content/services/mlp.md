# MLP

What each token works out on its own: the feed-forward half of a transformer layer.

> One of four services that take [LLM Decode](./llm-decode.md) apart into the
> steps of a transformer: [Token Embed](./token-embed.md),
> [Attention](./attention.md), [MLP](./mlp.md) and [Unembed](./unembed.md),
> with [Tokenize](./tokenize.md), [Sample](./sample.md) and
> [Detokenize](./detokenize.md) around them. The
> [GPT-2 Layer by Layer](../boards/gpt2-layers-board.md) board is all of them
> together.

---

## Available in

| Runtime | Service ID |
|---|---|
| Python (hkp-python) | `mlp` |

Needs the `transformer` extra (`uv sync --extra transformer` in `hkp-python`).

---

## What it does

[Attention](./attention.md) moves information between tokens; this is where
something is done with it. Each token's vector is normalised, spread out to
four times its width (3,072 numbers in GPT-2 small), put through a curve (GELU)
that lets some of it pass and holds the rest back, and projected back to the
stream's width. No token sees another here.

Most of a model's weights live in these layers, and much of what a model
recalls — that Paris goes with France, or `orange` with `yellow` — is written
into the stream by one of them.

Like Attention, the result is **added** to the stream.

Each call reports `{ layer, added, size }`, where `added` is how much this step
added to the last token's vector and `size` is how long that vector is
afterwards.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model's weights (`.safetensors`), as `hkp-asset://<id>` |
| `config` | `string` | `""` | The model's `config.json`, as `hkp-asset://<id>` |
| `layer` | `number` | `0` | Which of the model's layers this is, counted from 0 |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | the stream (`MixedData`), as [Attention](./attention.md) hands it on |
| **Output** | the stream (`MixedData`), with what this layer computed added |

---

## The model

`model` and `config` name board assets ([Assets](../concepts/assets.md)): a
`.safetensors` file with its `sha256` and a `config.json`. All services naming
them share one loaded copy in the runtime's model cache.

| State | Meaning |
|---|---|
| `status` | `idle`, `fetching`, `loading`, `ready` or `error` |
| `progress` | 0 to 1 while fetching, when the source says its size |
| `fetched` | the same as text — `76%` — for a panel to show; empty when nothing is being fetched |
| `problem` | why `status` is `error` |

---

## Demo board

The demo board runs layer 0 of GPT-2 small, attention then MLP, so the MLP's panel shows what it added on top. It fetches GPT-2 small (548 MB) the first time.
