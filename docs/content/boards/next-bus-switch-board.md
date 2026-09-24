# Next Bus Switch

The same job as [Next Bus](./next-bus-board.md) — when does the next bus leave —
built so that the "or else" is a branch in the board rather than a conditional
hidden inside a template string.

## What it does

Identical output: a speakable sentence about the next departure, or a sentence
saying there is not one.

## How it works

One [browser runtime](../concepts/runtime.md).

1. **Fetch Departures**, a [Fetcher](../services/fetcher.md), asks
   `v6.bvg.transport.rest` for the next ten minutes at one stop.
2. **Pick Departure**, a [Map](../services/map.md), takes the first upcoming one.
3. **Branch Sentence**, a [Switch](../services/switch.md), is the difference.
   Its matched case runs a [Map](../services/map.md) building
   *"The bus leaves in N minutes at HH:mm."*; its `default` case runs a
   different Map answering *"I found no upcoming departures."*
4. **Sentence**, a [Monitor](../services/monitor.md).

## Why this version exists

In [Next Bus](./next-bus-board.md) the missing-departure case is handled inside
the template that builds the sentence — a conditional expressed as an
expression. It works, and it is the shorter board.

This version makes the two outcomes two visible paths. You can see at a glance
that there are exactly two answers, and each one is a plain template with no
branching in it. That is the trade the
[structured-flow principle](../concepts/runtime.md#control-flow) is about:
a conditional inside a string is invisible, a Switch is a thing you can point
at.

Both are correct. Which one is better depends on whether the board is something
you will come back to.

## Try it

Save it as `next bus switch` and point the skill router's *next bus departure*
skill at it to use this version instead.
