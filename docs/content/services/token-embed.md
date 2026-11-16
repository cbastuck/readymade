# Token Embed

Where the model's forward pass begins: token ids become the stream the layers work on.

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
| Python (hkp-python) | `token-embed` |

Needs the `transformer` extra (`uv sync --extra transformer` in `hkp-python`).

---

## What it does

A token id means nothing to arithmetic. The model keeps two tables of vectors:
one for every entry of its vocabulary (`wte`), and one for every position a
token can stand at (`wpe`). For each token of the input, this looks both up and
adds them.

What leaves is **the stream**: one vector per token (for GPT-2 small, 768
numbers each). Every [Attention](./attention.md) and [MLP](./mlp.md) after this
reads the stream and adds to it, and [Unembed](./unembed.md) turns the last
token's vector back into scores at the end.

Nothing has looked at anything else yet. At this point each vector knows which
token it is and where it stands, and no more.

Each call reports `{ tokens, width, size }`, where `size` is the length (norm)
of the last token's vector.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model's weights (`.safetensors`), as `hkp-asset://<id>` |
| `config` | `string` | `""` | The model's `config.json`, as `hkp-asset://<id>` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `{ tokens, … }` as [Tokenize](./tokenize.md) hands them on |
| **Output** | the stream (`MixedData`): float32 of shape `[tokens, width]`, with the input and `shape` in its JSON side |

Inside one runtime the stream stays a tensor between services; it is serialised
only where it leaves. More tokens than the model has positions for, or a token
outside the model's vocabulary, pass nothing on and report why.

---

## The model

`model` and `config` name board assets ([Assets](../concepts/assets.md)): a
`.safetensors` file with its `sha256` and a `config.json`. The runtime fetches
the weights once per server, parses them once, and hands the same tensors to
every service that names them.

| State | Meaning |
|---|---|
| `status` | `idle`, `fetching`, `loading`, `ready` or `error` |
| `progress` | 0 to 1 while fetching, when the source says its size |
| `fetched` | the same as text — `76%` — for a panel to show; empty when nothing is being fetched |
| `problem` | why `status` is `error` |
