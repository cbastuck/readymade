# Voice Assistant (hkp-rt)

The [Voice Assistant](./voice-assistant-demo-board.md) with its entire middle
running on the C++ runtime — Whisper, llama.cpp and Kokoro all embedded in one
process, with no Python anywhere.

## What it does

Record, speak, stop, hear an answer. The same board shape, on different
machinery.

## How it works

Three runtimes.

**1 · recorder — the browser.** [Audio IO](../services/audio-io.md) captures
16 kHz PCM.

**2 · rt — a [REST runtime](../concepts/runtime.md#the-servers) on port 8887.**

- [Speech To Text](../services/speech-to-text.md) — Whisper via embedded
  sherpa-onnx.
- **Transcript**, a [Monitor](../services/monitor.md).
- [Text Generation](../services/text-generation.md) — embedded llama.cpp.
- **Answer**, a [Monitor](../services/monitor.md).
- [Text To Speech](../services/text-to-speech.md) — Kokoro via sherpa-onnx.

**3 · playback — the browser.** [Audio IO](../services/audio-io.md).

## Why this version exists

It is the same board against a different runtime, which is the claim the
architecture makes and this board tests: the services have the same ids and the
same contracts on hkp-rt as on hkp-python, so swapping one for the other is a
change of `url` and service configuration, not a rewrite.

It also matters for the mobile and desktop apps, where hkp-rt is compiled in and
Python is not available at all.

## Try it

Needs an hkp-rt built with `-DHKP_SPEECH_ENABLED=ON` and
`-DHKP_LLAMA_ENABLED=ON`, launched as `hkp-rt 8887`. Models are expected under
`~/Development/claude/models`: `sherpa-onnx-whisper-tiny` (multilingual — not
the `.en` build, which crashes the decoder), `kokoro-en-v0_19`, and a GGUF for
the LLM.

**Keep utterances short, around five seconds.** One
[FloatRingBuffer](../concepts/runtime.md#what-crosses-a-runtime-boundary) hop is
capped at about 88,200 samples — roughly 5.5 s at the 16 kHz input rate, and
3.67 s at the 24 kHz output rate.
