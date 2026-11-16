# LLM Pipeline

What a language model does to answer you, with every step on the board.

[Text Generation](../services/text-generation.md) takes a prompt and returns
text. This board is the inside of that call, cut where llama.cpp's own API
cuts, so each step's result can be looked at and each step changed.

## What it does

Type a message and press **Write**: the answer appears a token at a time. Or
press **From the start, one token** and then **Next token**, and watch one
round at a time:

- on the left, the message as the model is really given it — wrapped in its
  chat template and cut into tokens — and the text as it grows;
- on the right, the ten most likely next tokens as the model scored them, the
  same list after the samplers, and which one was picked.

Then change something. The knobs turn top-k, top-p and temperature while it
runs. In the board view, reorder the samplers, remove one, or switch the last
from `pick` to `greedy`.

## How it works

```
chat-template → tokenize → loop [ llm-decode → sample ×5 → detokenize ]
```

1. [Chat Template](../services/chat-template.md) wraps the message in the
   control tokens the model was trained on.
2. [Tokenize](../services/tokenize.md) cuts that text into token ids.
3. A [Loop](../services/loop.md) then runs once per generated token, until the
   model emits its end token or 200 rounds have passed:
   - [LLM Decode](../services/llm-decode.md) runs the model and hands on one
     score for every entry of its vocabulary;
   - five [Sample](../services/sample.md) services narrow and reshape those
     scores — repetition penalty, top-k, top-p, temperature — and the last
     picks one token and appends it;
   - [Detokenize](../services/detokenize.md) turns the tokens back into text
     and says whether the model is done.

What a round hands to the next is the tokens, one longer. Nothing but the Loop
knows that this is a loop, and nothing in the Loop knows about tokens.

The first round runs the whole prompt. Every round after it runs one token:
LLM Decode keeps the work it did for what it has already seen. The counter
under the text shows both numbers.

## The model

Qwen3 0.6B, 8-bit, 640 MB, Apache-2.0 — small enough to run on a laptop's CPU
and good enough to answer in sentences. It is a board
[asset](../concepts/assets.md) named by address and hash: the runtime fetches
it once on first use, which takes a few minutes, and the dot beside *Model*
turns green when it is loaded. Any other chat model in GGUF form works the same
way: change the asset.

The system prompt ends in `/no_think`, which asks this model to answer without
writing out its reasoning first. It still opens and closes the place where the
reasoning would go — the answer begins with an empty `<think>` block — because
that is what it was trained to write. Take `/no_think` out to see the block
filled in, as tokens like any other.

## Before running it

The board runs on the hkp-rt the Readymade app embeds, built with llama.cpp —
the desktop apps. The iOS and Android apps do not carry it.
