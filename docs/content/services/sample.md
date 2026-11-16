# Sample

One step of choosing the next token: narrows the candidates, reshapes their scores, or picks one.

> One of the services that lay a language model out on a board:
> [Chat Template](./chat-template.md), [Tokenize](./tokenize.md),
> [LLM Decode](./llm-decode.md) (or [Token Embed](./token-embed.md),
> [Attention](./attention.md), [MLP](./mlp.md) and [Unembed](./unembed.md)),
> [Sample](./sample.md) and [Detokenize](./detokenize.md), with a
> [Loop](./loop.md) around the generation step.
> [Text Generation](./text-generation.md) does all of it in one call and is the
> service to use for getting text; these are for seeing and changing how text is
> made. See the [LLM Pipeline](../boards/llm-pipeline-board.md) and
> [GPT-2 Layer by Layer](../boards/gpt2-layers-board.md) boards.

---

## Available in

| Runtime | Service ID |
|---|---|
| C++ (hkp-rt) | `sample` |
| Python (hkp-python) | `sample` |

Needs hkp-rt built with llama.cpp (`HKP_LLAMA_ENABLED`, on by default on
desktop), or `uv sync --extra transformer` in hkp-python.

---

## What it does

The model hands over a score for every entry of its vocabulary. Between that
and one token being chosen lies a chain of small steps. Each instance of this
service is **one** of them, chosen by `mode`, and the order on the board is the
order they are applied in.

```
llm-decode → sample (repetition-penalty) → sample (top-k) → sample (top-p)
           → sample (temperature) → sample (pick)
```

| `mode` | What it does | Reads |
|---|---|---|
| `repetition-penalty` | lowers the scores of tokens among the last `lastN` | `penalty`, `lastN` |
| `top-k` | keeps the `k` highest | `k` |
| `top-p` | keeps the most likely until their probabilities sum to `p` | `p` |
| `min-p` | keeps what is at least `minP` as likely as the best | `minP` |
| `temperature` | divides the scores: below 1 sharper, above 1 flatter | `temperature` |
| `pick` | chooses one at random, by probability, and appends it | `seed` |
| `greedy` | chooses the highest, and appends it | — |

Each wraps the llama.cpp sampler of the same name.

The first five take scores and hand on scores. `pick` and `greedy` end the
chain: what leaves them is tokens again, one longer.

### What to try

- **Swap `pick` for `greedy`.** The text becomes the same every time, and
  often starts repeating itself.
- **Turn temperature up past 1.5** with top-k and top-p removed. The unlikely
  tokens get their chance and the text comes apart.
- **Move `temperature` in front of `top-p`.** Top-p keeps probabilities that
  sum to `p`; flatten them first and it keeps many more.
- **Remove the repetition penalty** from a greedy chain.

### What each step reports

```json
{ "mode": "top-k", "remaining": 40,
  "candidates": [ { "token": 6164, "piece": "Red", "p": 0.71 }, … ] }
```

`remaining` is how many candidates are still in the running; `candidates` the
`top` most likely of them, with their probabilities among what is left. Put
that beside [LLM Decode](./llm-decode.md)'s own report and a step's effect is
visible. `pick` and `greedy` report `chosen` — the token, its piece, and how
likely it was.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `""` | C++: the GGUF model whose vocabulary the scores are for, as `hkp-asset://<id>` |
| `tokenizer` | `string` | `""` | Python: optional `tokenizer.json` asset for reporting candidate `piece` strings |
| `mode` | `string` | `"pick"` | Which step this is; see above |
| `k` | `number` | `40` | `top-k` |
| `p` | `number` | `0.95` | `top-p` |
| `minP` | `number` | `0.05` | `min-p` |
| `temperature` | `number` | `0.8` | `temperature` |
| `penalty` | `number` | `1.1` | `repetition-penalty`: 1 is none |
| `lastN` | `number` | `64` | `repetition-penalty`: how far back it looks |
| `seed` | `number` \| `null` | `null` | `pick`: the same seed makes the same choices again; none, different ones each time |
| `top` | `number` | `10` | How many candidates each call reports |

Numbers may arrive as text (`"0.80"`), which is how a facade knob sends them.
An unknown `mode` is refused when it is configured.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | scores, as [LLM Decode](./llm-decode.md) or another Sample hands them on |
| **Output** | scores, with this step added to `applied` — or, for `pick` and `greedy`, `{ tokens, pieces, promptTokens }` with one token appended |

A step that narrows removes candidates; it does not reorder the scores. A
removed candidate's score is negative infinity, so the next step reads the
shape this one wrote, and `applied` says what has been done so far:
`["top-k 40", "top-p 0.95", "temperature 0.8"]`.

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
