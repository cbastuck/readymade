# Live stream from hkp-rt (microphone → MP3 → listeners)

Built 2026-09-27 on macOS. What it does is documented in
`docs/content/boards/live-radio-demo-board.md`, `services/http.md#streaming`,
`services/audio-encode.md` and `services/audio-io.md`. This file covers only
why the layout is what it is, what was verified, and what is still open.

## Decisions

- **The endpoint owns the fan-out** (option A). `http-server-subservices` has a
  `stream` config: a GET on its path becomes a kept listener, and whatever a pass
  produces goes to all of them. We rejected a separate `broadcast` service used
  from both pipelines (option B) because it would have to pass a live socket
  through the pipeline as `Data`. Every value in a pipeline today can be
  serialised and moved between runtimes, and a socket cannot. The fan-out logic
  is a plain class (`common/stream_broadcast.h`), so a websocket server can
  reuse it without adding anything to the data model.
- **One encoder that lives across passes, no windowing of our own.** LAME already
  keeps the history and lookahead its psychoacoustic model needs. The rule is to
  never flush mid-stream. The only history we keep ourselves is on the output
  side: the burst a newcomer gets.
- **Chunks are whole MP3 frames** (`Mp3FrameSplitter`), so a listener can start
  at any chunk, and dropping a chunk never tears a frame.
- **No idle state.** Encoding runs whether or not anyone listens. Stopping when
  nobody listens would add code, and the startup delay would hit the first
  listener.
- **The realtime handoff is its own primitive** (`common/realtime_wakeup.h`).
  The audio thread does an atomic exchange plus a semaphore signal (a dispatch
  semaphore on Apple platforms). A worker thread posts onto the event loop
  through the new `RuntimeHost::post`. Signals coalesce until the pass
  acknowledges them.

## Verified

- Unit tests (hkp-rt service suite): `stream_broadcast.test.cpp` (queue,
  broadcast, wakeup, cross-thread ring buffer), `service_audio_encode.test.cpp`
  (frame parsing and splitting, wav, one-shot mp3, stream = whole frames with no
  per-pass delay), and `http_stream.test.cpp` (real sockets: head, fan-out, burst,
  hang-up, stop, ending the stream).
- End to end against a real `hkp-rt` process with the MacBook microphone
  (48 kHz, 1 channel, 512-frame buffers). Two listeners at once got valid MP3 at
  real-time rate (5 s pulled = 4.99 s of audio). The listener count went 2 → 0
  on hang-up, and the log showed no overruns. Each pass encoded exactly one
  callback's worth of samples, so the event loop kept up.

## Manual checks still to do

- [ ] Speak and listen on a phone via the QR code: is the voice clear, and how
      long is the delay end to end? (The e2e capture was a quiet room, peak
      −56 dBFS.)
- [ ] Load the board in the playground: do the facade's status, listener count,
      QR code and URL update on Start/Stop?
- [ ] A listener on a throttled connection falls behind, then catches up to near
      live without affecting the others.
- [x] Safari counted twice — its `bytes=0-1` probe was answered with the
      stream and kept open. Probes are now answered with 206 and closed;
      WebKit counts once and still plays.
- [ ] iOS Safari `<audio>` plays `audio/mpeg` with `Connection: close` and no
      length.
- [ ] A two-channel interface with `channels: 2`.

## Latency, measured 2026-09-27

Measured from mic to ear, loopback, 128 kbps mono at 48 kHz, in Chrome 153
(headless) and WebKit (WKWebView on macOS 15.6, Safari's engine and media
stack):

| Stage | Adds |
| --- | --- |
| audio callback + LAME delay + one frame, hkp-rt | ~60 ms |
| server → socket | nothing: frames leave as they finish (≈1.5 KB per 100 ms) |
| Chrome, plain `<audio src>` | 2.3 s: starts after 2.2 s; reads in 32 KB blocks (2 s at 128 kbps), so it scales with bitrate |
| Safari/WebKit, plain `<audio src>` | 5.4 s: starts after 5.3 s, then keeps ~4.4 s buffered |
| Chrome, MSE player | 0.48 s steady, starts in 0.42 s, no stalls |
| WebKit, MSE player | 0.6–1.1 s, starts in 0.44 s, no stalls; held there by playing 5% faster when it drifts |

Nearly all of the delay is the browser's own player, and a server cannot reduce
it. Jumping `currentTime` to the live edge on a plain `<audio>` works in both
engines, but it skips audibly and races Chrome's 2 s blocks. A player page that
fetches the stream and feeds it to Media Source Extensions (`audio/mpeg` is
supported by both; `ManagedMediaSource` is the one iOS Safari requires) gets
under a second. It is now part of the board — see the first item under Open.

## Cloud relay — built 2026-09-28

Decided by the user: the relay is hkp-node, and the uplink is a WebSocket rather
than Icecast's HTTP `PUT`. WebSocket messages keep chunk boundaries, so the relay
passes whole frames on without parsing MP3. They also give a back channel (close
codes, pings) and reuse the mount upgrade path hkp-node already had.

- **hkp-node `http-server-subservices`:** a port of the `stream` feature
  (`src/services/stream.ts`). It first also took a **source** (a WebSocket on
  the stream path, `ingestKey`); step 2 below moved that into `websocket-reader`.
- **hkp-rt `websocket-writer`:** rebuilt on `url` (ws/wss/http(s)/mount reference
  + `path`) and `headers` resolved from secrets. It writes asynchronously on its
  own thread, reconnects with backoff, pings to detect dead connections, and
  keeps a bounded drop-oldest queue (16 KB by default). The `host`/`port`/`path`
  form and its hello message are unchanged; `WriterSession` is gone.
- **hkp-rt answer envelope** (from the player-page work) serves the page on
  hkp-rt; on hkp-node a `map` serves it.
- **Board:** `live-radio-cloud-direct-demo-board.json` (was `live-radio-cloud-demo-board.json` until the chained relay below took that name).

Verified end to end on loopback, with the real mic → hkp-rt → hkp-node →
listeners:
- the relay stream decodes (48 kHz mono, 128 kbps, real-time rate);
- through the relay, the player page buffers 0.3 s in Chrome and 0.4–0.5 s in
  WebKit;
- the listener count is exact;
- switching the relay off and on: the writer retried three times, reconnected,
  and resumed.

Not verified:
- `wss://` against a real TLS server (it compiles, and uses http-client's
  certificate setup and host-name verification);
- the frontend coordinator writing the relay's address onto the hkp-rt writer
  in the running app. The first try in the app stuck at "waiting for the
  address": the relay comes out of bypass after load, and a remote service's
  later reports never reached board state, so the coordinator had nothing to
  resolve. Fixed 2026-09-28 (`withReportedMount()`, REST scope report targets);
  the writer then showed the resolved `ws://…/hosted/…/live.mp3` target in the
  app;
- a reverse proxy in front of the relay.

## Two cloud boards: chained and direct (decided 2026-09-28)

The user's call: the relay should not be a special mode of the endpoint, and
the natural path is the board's own chain — hkp-rt's result goes on to the
hkp-node runtime that follows it. Both variants are kept, chosen by need:

- **Chained** (`live-radio-cloud-demo-board.json`, the default):
  `mic → encode` | `radio (stream) → stopper`. No writer, no mount reference,
  no secret. The result passes through whoever runs the board (the window,
  loopback here, so ~1 ms), with no bound: a stalled uplink makes listeners
  fall behind rather than skip, and a busy main thread can delay frames.
- **Direct** (`live-radio-cloud-direct-demo-board.json`): the writer connects
  to the relay itself, bounded to ~1 s, independent of the window.

Latency in normal operation was expected to be the same for both; the
difference is under a poor uplink or a busy window.

Steps:
1. **Chain carries bytes** — done 2026-09-28. Bytes cross a runtime boundary as
   YAS BinaryData (raw bytes after the sender): the frontend writes a
   `Uint8Array` that way (`Message.ts`), hkp-node reads and writes it on the
   runtime socket (`src/yas.ts`, `server.ts`) and its coordinator routes it
   between runtimes (`session.ts`), hkp-rt reads it (`message.cpp`; it already
   wrote it). Order: hkp-node starts each pass synchronously in arrival order,
   so no serialization was added; pinned by
   `hkp-node/tests/runtime-socket-binary.test.ts`. The REST fallback (socket
   not open) drops bytes with a warning, since JSON cannot carry them. A binary
   frame carries no run context, so its pass starts a trace of its own. Not
   yet run in the app — since run in the app by the user, working.
2. **Direct variant, recomposed** — done 2026-09-28. hkp-node gained
   `websocket-reader` (`src/services/websocket-reader.ts`): the same id and job
   as hkp-rt's (accept connections, hand each message on), served at a mount
   instead of a port, admitting only a client with `key` (bearer or `?key=`,
   unset = nobody), `exclusive` for one client at a time with the newest
   winning. Named reader rather than server because hkp-rt's `websocket-server`
   (registered as `websocket-socket`) is the one that sends. The source,
   `ingestKey` and upgrade path are gone from `http-server-subservices`; it only
   fans out. Board: `mic → encode → websocket-writer (hkp-mount://relay/ingest)
   → stopper` | `ingest (websocket-reader) → radio → stopper`. Loopback with the
   real mic: 7.0 s of valid MP3 in a 7 s capture, writer `connected`, one
   reader connection, nothing dropped. Not yet run in the app.
3. **Measure both** with the player, normally and with a throttled uplink, and
   say in the board docs when to pick which — open.

## Open

- **The player page is board content**, decided 2026-09-27 (option B). hkp-rt
  gained the answer envelope that hkp-node and hkp-python already had, and the
  board's `onRequest` is a Static holding the page. Measured when served from
  hkp-rt: Chrome 0.3 s and WebKit 0.4–0.5 s buffered; Stop/Listen drops and
  restores the listener. Still to check: iOS Safari (ManagedMediaSource) on a
  real phone, and whether a page kept in a Static's state is comfortable
  enough to edit.

- **Further latency tuning.** Measured (above): hkp-rt adds ~60 ms and the
  player the rest. Only worth pursuing below ~0.5 s. The levers are: a smaller device
  buffer, a lower LAME `quality` number for speed, disabling the bit reservoir
  (cleaner joins at some cost in quality), and `burstBytes`. The player's own
  buffering will probably dominate.
- **Other targets.** mp3lame is in the vcpkg manifest for `osx` only. Linux needs
  the platform line widened. iOS and Android need their own manifests and a
  microphone service that uses the same handoff (`microphone` on iOS).
- **The channel count is set by hand.** The encoder's `channels` has to match
  what `core-input` reports. A mismatch plays at the wrong speed. Per the
  FloatRingBuffer convention this stays board configuration, but a board could
  surface the mismatch.
- **Realtime safety elsewhere, found and not changed:**
  - `core-output` / `FloatRingBuffer::consumeBinary` log to stdout from the
    audio thread on underrun.
  - `deferPropagation: false` runs the whole chain on the audio thread,
    lifecycle notifications (JSON allocations) included.
  - `Runtime::scheduleProcessFrom` fills a slot array from the calling thread
    while the event loop drains it. `core-input` no longer uses it, but other
    callers still do.
- **Per-pass lifecycle notifications.** Each pass sends `call-process` /
  `call-process-finished` for every service, which is about 94 JSON messages a
  second on this board. It is harmless for now, but a stream might want to mute
  them.
