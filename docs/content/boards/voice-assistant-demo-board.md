# Voice Assistant

Push Record, speak, push Stop, and hear an answer — with nothing leaving your
machine. Speech in, speech out, across three runtimes that each do the part they
are suited to.

## What it does

The browser captures your voice, a Python runtime transcribes it, answers it and
speaks the answer, and the browser plays the result back.

## How it works

Three runtimes in chain order, and the split is the design.

**1 · recorder — the browser.** [Audio IO](../services/audio-io.md) captures
16 kHz PCM. Capture belongs here because the microphone is here; nothing else in
the board could reach it.

**2 · python — a [REST runtime](../concepts/runtime.md#the-servers) on port 8080.**

- [Speech To Text](../services/speech-to-text.md) transcribes with
  faster-whisper.
- **Transcript**, a [Monitor](../services/monitor.md), shows what it heard —
  worth having, because most surprising answers turn out to be surprising
  transcriptions.
- [Text Generation](../services/text-generation.md) answers via an
  OpenAI-compatible llama-server on port 8081. Its system prompt asks for one or
  two short spoken sentences, no markdown and no lists, because the reply is
  going to be read aloud rather than displayed.
- **Answer**, another [Monitor](../services/monitor.md).
- [Text To Speech](../services/text-to-speech.md) synthesises with Kokoro-82M.

**3 · playback — the browser.** [Audio IO](../services/audio-io.md) plays it.

## Why three runtimes rather than one

The microphone and the speaker are in the page; the models are not, and could
not be. What crosses each boundary is audio as a
[FloatRingBuffer](../concepts/runtime.md#what-crosses-a-runtime-boundary) —
serialised, not handed over. The board is the same shape it would be if the
Python runtime were on another machine, which is the point: moving it there is a
`url` change.

## Variants

- [Voice Assistant (local model)](./voice-assistant-local-demo-board.md) — same
  board with the LLM loaded in-process instead of over a server.
- [Voice Assistant (hkp-rt)](./voice-assistant-hkp-rt-demo-board.md) — the whole
  middle on the C++ runtime.
- [Voice Assistant + Skills](./voice-assistant-skills-demo-board.md) — the same,
  with spoken requests routed to purpose-built boards.

## Try it

Needs hkp-python on port 8080 with both extras —
`pip install "hkp-python[asr,tts]"` — and an OpenAI-compatible LLM server on
port 8081. First use downloads the Whisper and Kokoro models, so give it a
moment.
