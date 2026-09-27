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
