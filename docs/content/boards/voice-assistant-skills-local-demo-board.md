# Voice Assistant + Skills (local model)

[Voice Assistant + Skills](./voice-assistant-skills-demo-board.md) configured
against a local llama-server rather than whatever happens to be on port 8081.
Same five runtimes, same routing, same convergence.

## What it does

Identical: spoken requests matching a skill are dispatched to a board, anything
else goes to the model, and both are spoken through one voice.

## What differs

Only how [Text Generation](../services/text-generation.md) reaches a model. This
variant is set up for a specific local server:

```
./build/bin/llama-server -m ~/…/models/Bonsai-27B-Q1_0.gguf \
  --port 8081 -c 8192 -ngl 99
```

Bonsai's 1-bit quantisation needs the **PrismML llama.cpp fork** — the stock
`llama-cpp-python` will not load a `Q1_0` GGUF. That is a property of the model
file, not of Readymade, and it is why this board is kept separate rather than
being a note on the other one.

## How it works

See [Voice Assistant + Skills](./voice-assistant-skills-demo-board.md); the
structure is unchanged. In short: capture → transcribe → route, with a match
early-returning past the model to a
[Board Service](../services/board-service.md) that plays the named skill board,
and both paths converging on one
[text-to-speech](../services/text-to-speech.md) stage before playback.

## Try it

Needs hkp-python on port 8080 with `pip install "hkp-python[asr,tts]"`, the
llama-server above on port 8081, and the `send ntfy`, `current time` and
`next bus switch` boards saved locally.
