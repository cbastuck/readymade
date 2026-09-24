# Alpaca Markets

A live stock trade feed over an authenticated WebSocket, where the interesting
part is not the data but the handshake — a three-step login conducted by
services that feed their own output back into themselves.

## What it does

It connects to Alpaca's market data stream, authenticates, subscribes to trades,
and shows them in a table with a running volume delta.

## How it works

One [browser runtime](../concepts/runtime.md). Four services at the top level,
and the first one contains the whole protocol.

**1. Alpaca Feed Feedback** — a Feedback service wrapping a sub-pipeline. A
WebSocket handshake is a conversation: connect, be told to authenticate, send
credentials, be told you are authenticated, subscribe, be told you are
subscribed. Each of the server's replies has to produce the next message. That
is a loop, and feedback is how this board expresses one — the inner pipeline's
output goes back in as its input until `handshakeComplete` is set, at which
point `skipFeedbackWhen` opens the loop and messages flow on downstream.

Inside it:

- **Alpaca Stream**, a WebSocket client on `wss://stream.data.alpaca.markets/v2/iex`.
- **Unpack**, a [Map](../services/map.md) taking one message out of the array.
- **Auth**, an [If](../services/if.md) matching `T == 'success' && msg == 'connected'`,
  whose sub-pipeline builds the auth message.
- **Subscribe**, an If matching `msg == 'authenticated'`, building the
  subscribe message.
- **Detect Subscribe Ack**, an If matching `T == 'subscription'`, which sets the
  runtime variable `handshakeComplete` and then
  [Stops](../services/stopper.md) — the acknowledgement itself is not trade
  data and should go no further.

**2. Format Trade** — a [Map](../services/map.md) shaping each trade for display.

**3. Volume Delta** — computes the change per 1000 ms interval.

**4. Trade Feed** — a [Monitor](../services/monitor.md) keeping the last 100.

## Why it is worth reading

Most boards on this page are a line. This one is a state machine, and it is
built out of the same parts: three `If` services standing in for three states,
a runtime variable as the flag, a stopper to swallow the message that only meant
"ready", and feedback to run the whole thing until it settles. No branching
syntax appears anywhere — see [control flow](../concepts/runtime.md#control-flow).

## Try it

It needs an Alpaca API key and secret, entered in the facade's two text inputs.
The JSON input holds the subscription request, so you can change which symbols
it follows without touching the board.
