# Live Radio

Your microphone as a radio station: captured, encoded to MP3 as it arrives, and
streamed to anyone who opens the URL. Two services do the work, and the
arrangement between them is what the board is about.

## What it does

Press Start and the board goes on air. Open the stream URL in a browser tab or
VLC, or scan the QR code with a phone, and you hear the microphone with a delay
of a fraction of a second plus whatever the player chooses to buffer. Listeners
can come and go at any time; they all hear the same stream.

## How it works

One [REST runtime](../concepts/runtime.md) on hkp-rt. Nothing passes through the
browser except the controls.

1. [core-input](../services/audio-io.md#core-input) captures the microphone. Its
   callback runs on the realtime audio thread and does only two things: it
   appends the samples to a ring buffer and signals. `deferPropagation` is on,
   so everything after it runs on the runtime's event loop instead. The ring
   buffer carries the samples across, so a pass that starts a little late reads
   everything that arrived in the meantime.
2. [http-server-subservices](../services/http.md#streaming) declares a `stream`
   at `/live.mp3`. Its `onProcess` pipeline holds the encoder, so every pass
   encodes once and the result goes to every listener at once.
   - [Audio Encode](../services/audio-encode.md) in `stream` mode keeps one MP3
     encoder alive across all passes. Each pass hands it the new samples and
     passes on only the frames that are finished, as whole frames, so a
     listener can join between any two chunks.

3. **End Of Chain**, a [Stopper](../services/stopper.md). The endpoint has
   already written each chunk to its listeners. Without the Stopper, the chunk
   would also become the runtime's result and be sent to the browser forty
   times a second, where nothing needs it.

The encoder sits inside the endpoint rather than after the microphone because
encoding and serving belong together. The outer chain only hands PCM to an
endpoint, so the microphone could be swapped for any other sound source without
touching the rest.

## The three threads

- **Audio thread.** Appends and signals, nothing else. No allocation, no locks
  and no logging, whatever happens downstream.
- **Event loop.** Encodes, then hands each chunk to every listener's queue.
  Nothing on this thread waits on the network.
- **Server thread.** Writes to each connection asynchronously. A listener on a
  slow connection falls behind on its own. Past `maxQueueBytes` it loses its
  oldest unsent audio and jumps back near the live edge, so neither the stream
  nor anyone else waits for it.

## The facade

A status dot for the endpoint, a listener count, a QR code and the copyable
stream URL, and Start/Stop buttons. Start brings up the endpoint before the
microphone, so the first samples have somewhere to go; Stop does the reverse.

## Try it

Run hkp-rt on port 8887 (`hkp-rt 8887`) and load the board. Check the
microphone's **Channels** in its panel: the encoder is set to `1`, which matches
a built-in mic. For a two-channel interface, set the encoder's `channels` to `2`.
The stream is served on port 8890 on your LAN address.
