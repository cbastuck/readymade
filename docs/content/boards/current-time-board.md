# Current Time

A two-service board that answers with the date and time as a sentence somebody
could say out loud. It exists to be called by another board rather than opened
on its own.

## What it does

Given any trigger, it returns `{ "text": "Today it's Friday, July, 17. 2026 21:13" }`.
That is the whole contract.

## How it works

One [browser runtime](../concepts/runtime.md), two services.

1. **Build Sentence**, a [Map](../services/map.md) in `replace` mode, formats
   the current date and time into a speakable string.
2. **Sentence**, a [Monitor](../services/monitor.md), reports it so you can see
   the answer when the board is open by itself.

## Why it is a board and not a service

This is a **skill target**: the [Voice Assistant with skills](./voice-assistant-skills-demo-board.md)
board routes a spoken request here through
[Skill Router](../services/skill-router.md), and the calling board's
[text-to-speech](../services/text-to-speech.md) reads the returned `text` aloud.

Phrasing a skill as a board rather than a service is what makes it replaceable
without touching the assistant. The dispatcher finds it **by name**, so the
board has to be saved locally as `current time` for the lookup to succeed — see
[Board Service](../services/board-service.md) for how one board plays another.
