# Live Radio (Cloud Relay)

[Live Radio](./live-radio-demo-board.md), but for listeners anywhere on the
internet. The microphone stays at home. One stream goes up to a relay in the
cloud, and the relay passes it on to everyone listening.

## What it does

Press Start and the home machine goes on air through the relay. Share the QR
code or the player address; whoever opens it hears the microphone about half a
second late. The home machine needs no open port or public address, and it
uploads a single stream however many people listen.

## How it works

Two [REST runtimes](../concepts/runtime.md): hkp-rt at home, hkp-node in the
cloud. The relay follows the home runtime, so what the home runtime produces is
what the relay is given — [the chain](../concepts/runtime.md#the-chain), as on
any board. The MP3 frames travel as bytes all the way.

### Home (hkp-rt)

1. [core-input](../services/audio-io.md#core-input) captures the microphone. The
   audio thread only appends and signals; everything after it runs on the
   runtime's event loop.
2. [Audio Encode](../services/audio-encode.md) in `stream` mode: one MP3
   encoder for the whole broadcast, emitting whole frames. They are the home
   runtime's result, and go on to the relay.

### Relay (hkp-node)

1. [http-server-subservices](../services/http.md#streaming) declares a `stream`
   at `/live.mp3` and passes each pass it is given to everyone connected there.
   Every other request is answered by `onRequest`:
   - **Player page**, a [Map](../services/map.md) answering with an
     [answer envelope](../services/http.md#what-a-handler-may-answer-with) whose
     body names one of the board's [assets](../concepts/assets.md): the script
     for `/player.js`, the page for anything else. The page and its script are
     the assets **player** and **player-js** — edit them in the asset view, and
     the next listener to open the address gets the new version.
2. **End Of Chain**, a [Stopper](../services/stopper.md): nothing needs to go
   back.

The relay's address is a mount (`/hosted/<id>`): it stays the same across
restarts and redeploys and cannot be guessed, and it is all a listener needs.

## The window is part of the path

Runtimes do not dial each other: a result goes from one runtime to whoever runs
the board, and from there to the next. Here that is this window, on the same
machine as the home runtime, so the detour costs next to nothing — but the
board has to stay open while it is on air, and every frame passes through the
window's main thread. If the uplink stalls while the connection to the relay
stays open, the frames wait rather than being dropped, and listeners fall behind
for good. While that connection is closed — before it first opens, or between a
drop and the reconnect — there is nowhere for them to wait: those frames are
dropped, and listeners hear a gap. The window's console says how many bytes.

[Live Radio (Cloud, direct)](./live-radio-cloud-direct-demo-board.md) connects
the home runtime to the relay itself instead, and keeps at most about a second
waiting: pick it when latency has to stay bounded on a poor uplink, or when the
window may be busy.

## Try it

1. Run hkp-rt at home on port 8887 and hkp-node somewhere reachable. Point the
   **Relay** runtime's URL at the hkp-node server.
2. Load the board and press Start.
3. Share the QR code or the player address.
