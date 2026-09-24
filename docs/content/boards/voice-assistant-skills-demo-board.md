# Voice Assistant + Skills

The [Voice Assistant](./voice-assistant-demo-board.md) with a router in front of
the language model: when a spoken request matches a known skill, it is handled
by a purpose-built board instead of being answered by a model. Both paths end up
speaking through the same voice.

## What it does

Push Record and speak. *"What time is it"*, *"when does the next bus leave"* or
*"send a notification to topic X saying hello"* are dispatched to boards that
actually do those things. Anything else is answered by the model.

## How it works

Five runtimes. The branch happens at the third service and reconverges at the
fourth runtime.

**1 · recorder — browser.** [Audio IO](../services/audio-io.md) captures.

**2 · python — REST, port 8080.**
[Speech To Text](../services/speech-to-text.md) transcribes, a
[Monitor](../services/monitor.md) shows the transcript, and
[Skill Router](../services/skill-router.md) decides.

On a match the router **early-returns** `{ board, payload }`, skipping the rest
of its own runtime — so [Text Generation](../services/text-generation.md) and
the Answer monitor never run. On no match it passes the transcript through and
the model answers normally.

**3 · dispatch — browser.** **Skill Dispatch**, a
[Board Service](../services/board-service.md) in *board name from input* mode,
plays the board the router named, handing it the payload. The skill board
returns `{ text: … }`.

**4 · python-tts — REST, port 8080.**
[Text To Speech](../services/text-to-speech.md) — **one stage for both paths**.

**5 · speaker — browser.** [Audio IO](../services/audio-io.md) plays it, then
[Output](../services/output.md).

## The convergence is the design

Skill boards return `{ text: … }`, and the dispatcher passes model answers
through untouched. Because both branches arrive at the same shape, there is one
text-to-speech stage rather than two, and a skill result and a model answer are
spoken in the same voice by the same service.

That is what [early return](../concepts/runtime.md#control-flow) buys: the
branch skips work without forking the board. Adding a skill means writing a
board and pointing the router at it — nothing here changes.

## The skills it ships with

- [Current Time](./current-time-board.md) — saved as `current time`
- [Next Bus Switch](./next-bus-switch-board.md) — saved as `next bus switch`
- [Send ntfy](./send-ntfy-board.md) — saved as `send ntfy`

The dispatcher finds them **by name**, so they must be saved locally under
exactly those names.

## Try it

Needs hkp-python on port 8080 with `pip install "hkp-python[asr,tts]"`, an
OpenAI-compatible LLM server on port 8081, and the three skill boards saved.
[The local-model variant](./voice-assistant-skills-local-demo-board.md) removes
the separate LLM server.
