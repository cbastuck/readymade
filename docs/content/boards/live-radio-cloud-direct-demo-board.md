# Live Radio (Cloud, direct)

[Live Radio (Cloud Relay)](./live-radio-cloud-demo-board.md), with the home
runtime connecting to the relay itself. In the Cloud Relay board the stream
travels the way every result does, through the window running the board; here
it goes straight from home to the relay over a WebSocket of its own, which
keeps at most about a second of audio waiting. On a poor uplink listeners skip
ahead instead of falling behind, and a busy window cannot hold the stream up.
The price is a writer, a mount reference and a shared secret.

## What it does

Press Start and the home machine goes on air through the relay. Share the QR
code or the player address; whoever opens it hears the microphone about half a
second late. The home machine needs no open port or public address, and it
uploads a single stream however many people listen.

## How it works

Two [REST runtimes](../concepts/runtime.md): hkp-rt at home, hkp-node in the
cloud.

### Home (hkp-rt)

1. [core-input](../services/audio-io.md#core-input) captures the microphone. The
   audio thread only appends and signals; everything after it runs on the
   runtime's event loop.
2. [Audio Encode](../services/audio-encode.md) in `stream` mode: one MP3
   encoder for the whole broadcast, emitting whole frames.
3. [websocket-writer](../services/websocket.md#websocket-writer) sends each
   chunk to the relay over a WebSocket it opens itself. Its `url` is
   `hkp-mount://relay/radio`, a reference to the relay's endpoint that the board
   resolves once the relay has an address, plus the `path` `/live.mp3`. The
   `Authorization` header carries the ingest key from the secret `radio-ingest`.
   If the connection drops, it reconnects on its own. About a second of audio
   waits while it does; anything older is dropped.
4. **End Of Chain**, a [Stopper](../services/stopper.md): nothing needs to go on
   to the browser.

### Relay (hkp-node)

1. [http-server-subservices](../services/http.md#streaming) declares a `stream`
   at `/live.mp3` with `ingestKey` `{{secret.radio-ingest}}`. The home runtime's
   WebSocket on that path is the stream's source. A GET on it is a listener.
   Every other request is answered by `onRequest`:
   - **Player page**, a [Map](../services/map.md) answering with the page as an
     [answer envelope](../services/http.md#what-a-handler-may-answer-with).

The relay's address is a mount (`/hosted/<id>`): it stays the same across
restarts and redeploys and cannot be guessed. The key decides who may
broadcast; the address is all a listener needs.

## Latency

Measured on loopback with the relay on hkp-node:

| Listener | Behind live |
| --- | --- |
| Chrome, player page | 0.3 s buffered |
| WebKit (Safari), player page | 0.4–0.5 s buffered |

Add the network: one hop up from home to the relay and one down to the
listener.

## Try it

1. Run hkp-rt at home on port 8887 and hkp-node somewhere reachable. Point the
   **Relay** runtime's URL at the hkp-node server.
2. Load the board. When asked, give the secret `radio-ingest` a value; any long
   random string will do.
3. Press Start. The uplink dot turns green once the home runtime is connected.
4. Share the QR code or the player address.

If the relay sits behind a reverse proxy, make sure the proxy passes WebSocket
upgrades on `/hosted/`. The stream itself asks nginx not to buffer it.
