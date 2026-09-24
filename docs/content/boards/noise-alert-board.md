# Noise Alert

Watches the microphone level and sends a push notification when a room gets too
loud. Four services, one of which exists purely to stop it firing forty times a
second.

## What it does

It measures sound level continuously, and when the level crosses a threshold you
set, posts a message to an [ntfy.sh](https://ntfy.sh) topic — which arrives on
your phone.

## How it works

One [browser runtime](../concepts/runtime.md). Audio never leaves the page; only
the alert does.

1. [Microphone Monitor](../services/microphone-monitor.md) samples the input
   level every 50 ms. It starts stopped, because a board that grabs the
   microphone the moment it loads would be rude.
2. [Filter](../services/filter.md) is the threshold. Below it, the filter stops
   propagation and the rest of the chain never runs — which is the ordinary way
   to express "only when" without a branch.
3. [Debounce](../services/debounce.md) holds a three-second cooldown. Without it
   a single loud noise would send twenty notifications, because the level stays
   over the line for as long as the noise lasts.
4. [Fetcher](../services/fetcher.md) POSTs to the ntfy topic. Its body is an
   expression, not a fixed string —
   `concat('Noise threshold exceeded! Level: ', string(round(params.levelDb, 1)), ' dB')` —
   so the measured level travels with the alert.

Steps 2 and 3 are the whole design. The measurement is trivial; making it fire
*once per event* rather than once per sample is the part that takes thought, and
it is two services rather than any code.

## The facade

A level meter shows the live reading, a knob sets the threshold, two buttons
start and stop the monitor, and a text input holds the ntfy topic.

## Try it

Replace `YOUR_TOPIC_NAME` in the Fetcher URL with a topic of your own, subscribe
to it in the ntfy app, then start the monitor and make a noise.
