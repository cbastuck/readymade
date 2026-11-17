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

### Watching the answer form layer by layer

As the stream moves through the layers, each layer records its intermediate
vector and attention patterns beside the stream — as tensors, in a record that
stays in the runtime and is never sent (`MixedData.local`). When the stream
reaches Unembed, it also scores each of those intermediate vectors ("logit
lens") and reports:

- `candidates`: the `top` most likely next tokens at this point, with their
  probabilities;
- `layers`: one row per layer that ran (`{ step, layer, token, piece, p, attentionAdded, mlpAdded, size }`), showing what the model's top guess was
  after each layer;
- `attention`: the attention matrix and token pieces for `inspectLayer` and
  `inspectHead` — that one head's, not every head's. Changing `inspectLayer` or `inspectHead` re-emits the report
  immediately from the last run, so a knob on a facade can flip through layers
  and heads while generation is paused.

### Reading the answer early (`passThrough`)

Placed between two layers with `passThrough: true`, Unembed scores the stream
at that point, reports `candidates` and `layers` to its panel, and **hands the
stream on untouched** so the layers after it keep running.

The record does not cross runtimes: a stream that arrives from another runtime
has no layers to report until layers of this runtime have run on it.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | The model's weights (`.safetensors`), as `hkp-asset://<id>` |
| `config` | `string` | `""` | The model's `config.json`, as `hkp-asset://<id>` |
| `tokenizer` | `string` | `""` | Optional `tokenizer.json` asset, for reporting candidate `piece` strings |
| `top` | `number` | `10` | How many candidates each call reports |
| `passThrough` | `boolean` | `false` | Report the early answer here and hand the stream on unchanged |
| `inspectLayer` | `number` | `0` | Which layer's attention pattern to surface in `attention` |
| `inspectHead` | `number` | `0` | Which head's attention pattern to surface in `attention.pattern` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | the stream (`MixedData`), as [MLP](./mlp.md) or [Token Embed](./token-embed.md) hands it on |
| **Output** | scores (`MixedData`): one float32 per vocabulary entry, with the tokens and `applied: []` in its JSON side — or the input stream unchanged when `passThrough` is `true` |

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

---

## Demo board

The demo board runs two layers of GPT-2 small with an Unembed between them on `passThrough` and one at the end, so the two guesses can be compared. It fetches GPT-2 small (548 MB) the first time.
