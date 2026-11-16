# Attention

The one place in a transformer where tokens look at each other.

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
| Python (hkp-python) | `attention` |

Needs the `transformer` extra (`uv sync --extra transformer` in `hkp-python`).

---

## What it does

Everything else in the model works on each token alone. Here every token asks a
question of the tokens before it (its *query*), each of those offers what it is
about (its *key*), and how well the two match decides how much of the earlier
token's content (its *value*) the asking token takes.

A model does this several times side by side — its **heads** (12 in GPT-2
small) — each with its own idea of what is worth asking.

What the heads gathered is **added** to the stream, not put in its place. The
stream that leaves is the one that came in, plus what this layer found.

`layer` says which of the model's layers this is (counted from 0), and so which
weights it uses. Paired with [MLP](./mlp.md) of the same `layer` inside a
[Block](../concepts/blocks.md), it is one transformer layer on the board: delete
a use to skip that layer, duplicate it to run the layer twice, or reorder two
uses.

### What to change on pretrained weights

- **Switch individual heads off** (`disabledHeads`): pass `[0, 3]` or `"0, 3"`
  (or double-click a head tab in the service panel) to zero out those heads'
  contributions.
- **Change what a token may look at** (`mask`):
  - `causal` (default): each token looks at itself and everything before it;
  - `window`: each token looks only at the last `window` tokens up to itself;
  - `full`: each token looks at every token in the sequence, including tokens
    that follow it.
- **Sharpen or flatten attention** (`temperature`): divides the query-key match
  scores before softmax. Below 1 sharpens focus onto the single best-matching
  token; above 1 flattens attention toward an even average.

### What each call reports

```json
{
  "layer": 0,
  "heads": 12,
  "head": 0,
  "disabledHeads": [],
  "mask": "causal",
  "window": 4,
  "temperature": 1.0,
  "added": 21.4,
  "size": 58.9,
  "pieces": ["The", " colours", " of"],
  "headSizes": [3.1, 2.8, …],
  "pattern": [[1.0, 0.0, 0.0], [0.62, 0.38, 0.0], …],
  "patterns": [ … ]
}
```

`patterns` is one `tokens × tokens` matrix per head; `pattern` is the matrix
for `head`, ready for a `heatmap` facade widget.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model's weights (`.safetensors`), as `hkp-asset://<id>` |
| `config` | `string` | `""` | The model's `config.json`, as `hkp-asset://<id>` |
| `layer` | `number` | `0` | Which of the model's layers this is, counted from 0 |
| `mask` | `string` | `"causal"` | `"causal"`, `"window"` or `"full"` |
| `window` | `number` | `4` | How many tokens back a token may look when `mask` is `"window"` |
| `temperature` | `number` | `1.0` | Divides attention logits before softmax (`< 1` sharper, `> 1` flatter) |
| `disabledHeads` | `number[]` \| `string` | `[]` | Heads switched off, as `[0, 3]` or `"0, 3"` |
| `head` | `number` | `0` | Which head's matrix is reported as `pattern` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | the stream (`MixedData`), as [Token Embed](./token-embed.md) or an earlier layer hands it on |
| **Output** | the stream (`MixedData`), with what attention gathered added |

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
