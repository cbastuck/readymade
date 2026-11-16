# GPT-2 Layer by Layer

Inside the forward pass of a language model: every layer on the board as services.

The [LLM Pipeline](./llm-pipeline-board.md) board cuts text generation into
tokenize, forward pass, samplers and detokenize. This board opens the forward
pass itself: GPT-2 small (124M parameters, 12 layers), laid out so that the
residual stream travels from service to service and each layer can be looked
at, removed, repeated or reordered.

## What it does

Give the model the beginning of a sentence and press **Write**, or step through
it one token at a time with **From the start, one token** and **Next token**:

- on the left, the prompt cut into tokens, the growing continuation, and the
  width and length of the stream;
- on the right, the ten most likely next tokens as [Unembed](../services/unembed.md)
  scored them, the same list after the samplers, and which token was picked.

Then open the board view and change the model itself:

- **Delete a `Layer` block use** from the end or the middle of the stack and
  step again — one missing middle layer barely dents a common phrase, while
  dropping several shows the continuation gradually losing grammar and topic.
- **Duplicate a `Layer` use** so the same layer runs twice in a row.
- **Reorder two `Layer` uses** by changing their `layer` parameter.

## How it works

```
tokenize → loop [ token-embed → layer ×12 → unembed → sample ×5 → detokenize ]

layer (a block, param: layer)  =  attention → mlp
```

A transformer's residual connections look like wires around each step. Seen the
other way around — as one running tensor (**the stream**) that each step reads
and adds to — the model is an ordered list, which is what a Readymade runtime
already is:

1. [Tokenize](../services/tokenize.md) cuts the prompt into token ids.
2. Inside the [Loop](../services/loop.md), [Token Embed](../services/token-embed.md)
   looks up each token's embedding and its position embedding and adds them.
   What leaves is the stream: one vector of 768 numbers per token.
3. Twelve uses of the **Layer** [block](../concepts/blocks.md) (`layer` 0 to 11)
   each run [Attention](../services/attention.md) — where tokens gather
   information from earlier tokens — followed by [MLP](../services/mlp.md) —
   where each token computes on its own. Each adds its result to the stream.
4. [Unembed](../services/unembed.md) takes the last token's vector from the
   stream and compares it against the vocabulary to produce 50,257 scores.
5. Five [Sample](../services/sample.md) services narrow and reshape those
   scores and pick one token, and [Detokenize](../services/detokenize.md) turns
   the growing token list back into text.

## The model

GPT-2 small (124M parameters, MIT, 548 MB), declared as three board
[assets](../concepts/assets.md): `model.safetensors` (by URL and `sha256`),
`tokenizer.json` and `config.json`. The weights are fetched once to the
server's asset cache on first use and parsed once in the runtime's model cache,
so all twenty-six services that read the weights share one copy in memory.

Unlike the chat model in [LLM Pipeline](./llm-pipeline-board.md), GPT-2 is a
base model trained to continue whatever text it is given: give it the start of
a sentence rather than a question, and it writes on until the Loop reaches
`maxRounds` (40 tokens by default) or the model emits `<|endoftext|>`.

## Before running it

The board runs on **hkp-python** (`"remote": "python"`) with the `transformer`
extra installed:

```bash
cd hkp-python
uv sync --extra transformer
./run_server.sh
```
