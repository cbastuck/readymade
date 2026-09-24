# Next Bus

Asks Berlin's public transport API when the next bus leaves and answers with a
sentence somebody could say out loud. A skill target: built to be called by the
voice assistant, not opened on its own.

## What it does

It returns `{ "text": "The next bus leaves in 7 minutes." }`, or a fallback
sentence when nothing is departing in the window it asked about.

## How it works

One [browser runtime](../concepts/runtime.md), four services, no state.

1. **Fetch Departures**, a [Fetcher](../services/fetcher.md), GETs from
   `v6.bvg.transport.rest` for one stop and one direction, ten minutes ahead.
2. **Pick Departure**, a [Map](../services/map.md) in `replace` mode, takes the
   first departure's `when` timestamp.
3. **Build Sentence**, another [Map](../services/map.md), turns the difference
   between then and now into minutes and wraps it in a sentence.
4. **Sentence**, a [Monitor](../services/monitor.md), reports the answer.

Which stop it watches is the Fetcher's `url` and nothing else — change the
`stops/…` and `direction` ids there to point it somewhere else.

## Why it is a board

The [Voice Assistant with skills](./voice-assistant-skills-demo-board.md) board
dispatches to this one by name through
[Skill Router](../services/skill-router.md), and reads the returned `text` aloud
with [text-to-speech](../services/text-to-speech.md). Save it locally as
`next bus` or the dispatcher will not find it.

[Next Bus Switch](./next-bus-switch-board.md) is the same board with the
sentence-building moved into a [Switch](../services/switch.md); it is worth
reading the two together.
