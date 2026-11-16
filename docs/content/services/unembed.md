# Unembed

Where the forward pass ends: the stream becomes one score per vocabulary entry.

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
| Python (hkp-python) | `unembed` |

Needs the `transformer` extra (`uv sync --extra transformer` in `hkp-python`).

---

## What it does

Only the last token's vector in the stream is read. It is normalised (`ln_f`)
and compared with the vector of every entry of the vocabulary — the same table
(`wte`) that [Token Embed](./token-embed.md) looked up at the start — and how
well each matches is that entry's score (*logit*): how much the model expects
that token to come next.

Nothing is chosen here; that is what [Sample](./sample.md) is for. What leaves
is the exact same `MixedData` scores shape that [LLM Decode](./llm-decode.md)
hands on in `hkp-rt`, so the same chain of `sample` services follows either.

Placed after the last layer, it gives the model's answer. Placed after an
earlier layer — or with the later layers removed — it shows what the model
would say if it stopped there, so the answer can be watched forming layer by
layer.

Each call reports `{ candidates }`: the `top` most likely next tokens with
their probabilities, before any sampler has touched them.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model's weights (`.safetensors`), as `hkp-asset://<id>` |
| `config` | `string` | `""` | The model's `config.json`, as `hkp-asset://<id>` |
| `tokenizer` | `string` | `""` | Optional `tokenizer.json` asset, for reporting candidate `piece` strings |
| `top` | `number` | `10` | How many candidates each call reports |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | the stream (`MixedData`), as [MLP](./mlp.md) or [Token Embed](./token-embed.md) hands it on |
| **Output** | scores (`MixedData`): one float32 per vocabulary entry, with the tokens and `applied: []` in its JSON side |

---

## The model

`model`, `config` and `tokenizer` name board assets
([Assets](../concepts/assets.md)). All services naming them share one loaded
copy in the runtime's model cache.

| State | Meaning |
|---|---|
| `status` | `idle`, `fetching`, `loading`, `ready` or `error` |
| `progress` | 0 to 1 while fetching, when the source says its size |
| `fetched` | the same as text — `76%` — for a panel to show; empty when nothing is being fetched |
| `problem` | why `status` is `error` |
