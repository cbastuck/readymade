# Audiolize

Wikipedia's live edit stream, played as music. Every edit anywhere in Wikipedia
arrives as an event; the board turns each one into a note and plays what comes
out.

## What it does

It opens the public Wikimedia recent-changes stream and sonifies it. Small edits
become one voice, large ones another, and the result is a rhythm that follows
how busy Wikipedia happens to be.

## How it works

One [browser runtime](../concepts/runtime.md). The whole thing is four services,
two of which are [Tracks](../services/tracks.md) doing different jobs.

1. **Wikipedia Recent Changes**, an [Input](../services/input.md), holds a
   persistent connection to `stream.wikimedia.org` and injects every message as
   a new pipeline trigger. This is the board's clock — it has no timer, because
   the data arrives on its own schedule.
2. **Notes**, a [Tracks](../services/tracks.md), maps one edit into two possible
   notes over two tracks, `snare` and `bass`, each a [Map](../services/map.md)
   deciding what that edit sounds like.
3. **Aggregates**, a second [Tracks](../services/tracks.md), is the musical
   part. Each track picks its note out and hands it to an
   [Aggregator](../services/aggregator.md) with an interval:
   - `snare` aggregates over **90 ms**, taking the most frequently occurring
     note (`val_max_occ`) in that window.
   - `bass` aggregates over **180 ms** — half the rate, so it plays half as
     often.

   Its `reduce` track then collapses whatever the two produced into a single
   thing to play.
4. [Sound](../services/sound.md) plays it.

## Why the aggregators are the design

Wikipedia edits do not arrive on a beat; they arrive in bursts. Feeding them
straight to a synthesiser would produce noise. The two aggregation windows
impose a tempo — one fast voice, one at half speed — so the music has a pulse
that the data does not. Changing the feel of this board means changing two
numbers.

It is also a clean example of fan-out and reduce being used twice in a row for
different reasons: first to *derive* two interpretations of one event, then to
*rate-limit* each one independently before they are recombined.
