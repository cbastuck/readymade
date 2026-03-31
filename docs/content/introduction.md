# Introduction

This document introduces the core concepts of the hkp platform: boards,
runtimes, services, and the data that flows between them. It ends with a
reference table of every service available across the supported runtimes.

---

## The Board

A **board** is the top-level unit of composition. It is a named
collection of one or more runtimes, each of which contains an ordered
list of services. The board captures a complete, self-contained
description of a data-processing or interactive system.

Boards can be created visually in the browser UI, and the full state of
any board can be exported and restored as a single JSON document. This
document is called a **Board Blueprint**. A Board Blueprint can be
pasted into **Edit Board Source** in the board menu to recreate an
identical setup on any compatible deployment.

A minimal Board Blueprint looks like this:

```json
{
  "boardName": "My Board",
  "runtimes": [
    { "id": "rt-1", "name": "Browser", "type": "browser", "state": {} }
  ],
  "services": {
    "rt-1": [
      {
        "uuid": "svc-1",
        "serviceId": "hookup.to/service/timer",
        "serviceName": "Timer",
        "state": { "periodicValue": 1, "periodicUnit": "s", "periodic": true, "running": true }
      }
    ]
  }
}
```

See [`docs/llm/circle-text-board.json`](./llm/circle-text-board.json)
for a complete, runnable example.

---

## Runtimes

A **runtime** is an execution environment that hosts services and
processes data through them. Every runtime on a board runs
independently; runtimes of different types can coexist on the same board
and exchange data via the network services available to them.

Three runtime types are supported:

### Browser Runtime (`type: "browser"`)

Runs entirely inside the browser using JavaScript. No server or
installation is required. All 23 browser services are available
immediately. Ideal for interactive dashboards, rapid prototyping, and
offline-capable applications.

### Remote Runtime (`type: "remote"`)

Connects to an external **hkp-rt** C++ server over GraphQL and
WebSocket. The runtime's processing pipeline runs on the server; the
browser UI shows the controls and receives output via a persistent
WebSocket channel. Remote runtimes unlock the full hkp-rt service set:
audio I/O, FFT, file system access, native WebSocket servers, HTTP
servers, and more.

A remote runtime needs a `url` pointing to a running hkp-rt instance.
Authentication is supported for managed cloud deployments.

### Realtime Runtime (`type: "realtime"`)

An embedded hkp-rt instance hosted directly inside a desktop
application. Used by [**Meander**](#meander--local-and-remote-together)
and hkp-saucer. From the board's point of view it behaves like a remote
runtime, but the server runs locally in the same process as the UI —
removing any network overhead and enabling direct audio I/O on the host
machine.

---

## Services

A **service** is a single processing node inside a runtime. Services are
listed in order within a runtime, forming a **pipeline**: the output of
each service becomes the input of the next. A service that returns
`null` stops the pipeline at that point — nothing downstream receives
data from that tick.

Every service has:

- A **`serviceId`** — a URI that uniquely identifies the service type,
  e.g. `hookup.to/service/timer` or `map` (in hkp-rt).
- A **`uuid`** — a per-instance identifier that is stable across saves
  and restores.
- A **`state`** object — the persisted configuration, saved into the
  Board Blueprint and restored on load.
- An optional **bypass** flag that skips the service while keeping it in
  the pipeline.

Services may also expose a **UI component** (in the browser runtime)
that lets the user inspect and modify their configuration in real time.

---

## Data flow

Data enters a pipeline when the runtime is triggered. The trigger can
come from:

- A **Timer** service firing on a schedule.
- A user action (button press, XY pad touch, sequencer step).
- An incoming network message (WebSocket, HTTP POST, SSE stream).
- An explicit `processRuntime` call from another service.

The data object — always a plain JSON-serialisable value — is passed
from service to service. Each service may transform, filter, enrich, or
replace it. The final output of the pipeline can be:

- Rendered visually (Canvas, Monitor, Output).
- Sent over the network (Output, WebSocket Writer, HTTP Client).
- Fed into another runtime on the same board via the Output/Input pair
  or via direct `processRuntime` calls.

### Cross-runtime data exchange

Runtimes on the same board run independently but can exchange data:

```
Browser Runtime                    Remote / Realtime Runtime
─────────────────                  ──────────────────────────
Timer → Map → Output  ──HTTP/WS──► Input → FFT → Monitor
                       ◄──WS─────  (result streams back)
```

The **Output** service sends the current pipeline value to a URL via
HTTP POST or WebSocket. The **Input** service on the receiving runtime
reads from an SSE stream or WebSocket and injects each arriving message
as a new pipeline trigger. This pattern lets browser and server-side
pipelines be composed into a single end-to-end flow described entirely
by a Board Blueprint.

---

## Meander — local and remote together

**Meander** is a native desktop application (macOS) that bundles the
hkp-rt C++ runtime alongside the browser-based board UI. When Meander
starts, it launches an embedded hkp-rt server on a local port and
exposes it to the frontend as a `realtime` runtime.

This means a single board opened in Meander can simultaneously use:

- **Browser services** — running in the embedded WebView (JS, no install
  needed).
- **Realtime (hkp-rt) services** — running natively in C++ on the local
  machine, with access to audio I/O, the file system, and native
  networking.
- **Remote services** — connecting to additional hkp-rt instances
  running elsewhere on the network or in the cloud.

A Board Blueprint authored in Meander is portable: the same JSON can be
loaded on a headless server, in a plain browser, or on another Meander
installation. Services whose runtime type is not available on the target
will simply not restore — the rest of the board remains intact.

```
┌────────────────────────── Meander ───────────────────────────┐
│                                                              │
│  ┌── Browser Runtime ───┐   ┌── Realtime Runtime ─────────┐ │
│  │  Timer → Map         │   │  core-input → fft → monitor │ │
│  │  Canvas ← ←  ← ← ←  │   │  WebSocket-writer ──────────┼─┼──► cloud
│  └──────────────────────┘   └─────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Available services

### Browser Runtime services

| Service ID | Name | What it does |
|---|---|---|
| `hookup.to/service/timer` | Timer | Emits a tick with an incrementing `triggerCount` on a periodic or one-shot schedule |
| `hookup.to/service/map` | Map | Transforms input JSON using a template with static and dynamic (expression) fields |
| `hookup.to/service/filter` | Filter | Passes or blocks input based on a JavaScript boolean expression |
| `hookup.to/service/aggregator` | Aggregator | Counts occurrences of a property value and emits the most frequent at a set interval |
| `hookup.to/service/buffer` | Buffer | Accumulates items until a capacity or time threshold, then emits the batch |
| `hookup.to/service/injector` | Injector | Injects a static value into the pipeline, overriding or extending the current data |
| `hookup.to/service/monitor` | Monitor | Displays the current pipeline value; passes data through unchanged |
| `hookup.to/service/canvas` | Canvas | Renders 2D draw commands (text, shapes, images, video) onto an HTML `<canvas>` |
| `hookup.to/service/input` | Input | Reads a continuous data stream from an SSE or WebSocket URL and emits each message |
| `hookup.to/service/output` | Output | Sends the current pipeline value to a remote URL via HTTP POST or WebSocket |
| `hookup.to/service/fetcher` | Fetcher | Makes an HTTP request and emits the response body as JSON, text, or binary |
| `hookup.to/service/stack` | Stack | Embeds a nested sub-pipeline of services that runs as a single composable unit |
| `hookup.to/service/sequencer` | Sequencer | Steps through a user-defined sequence, emitting the data at each step on demand |
| `hookup.to/service/looper` | Looper | Replays a recorded sequence of values at the original timing |
| `hookup.to/service/trigger-pad` | TriggerPad | A button that sends a configurable payload when pressed |
| `hookup.to/service/xy-pad` | XYPad | A 2D touch/drag pad that emits `{x, y}` normalised coordinates |
| `hookup.to/service/camera` | Camera | Captures frames from the device camera and emits them as image data |
| `hookup.to/service/hacker/considered` | Hacker | Runs arbitrary JavaScript in a sandboxed context; considered variant enforces stricter limits |
| `hookup.to/service/hacker/dangerous` | Hacker (dangerous) | Runs arbitrary JavaScript with access to the full browser environment |
| `hookup.to/service/spotify` | Spotify | Reads playback state and track metadata from the Spotify Web API |
| `hookup.to/service/github-source` | GitHub Source | Fetches content (files, issues, etc.) from a GitHub repository |
| `hookup.to/service/github-sink` | GitHub Sink | Writes content back to a GitHub repository |
| `hookup.to/service/ollama-prompt` | Ollama Prompt | Sends a prompt to a local Ollama instance and streams the response |

### hkp-rt Runtime services

The hkp-rt services use short IDs (no URI prefix) and are available on
both **Remote** and **Realtime** runtimes backed by an hkp-rt server.

| Service ID | Name | What it does |
|---|---|---|
| `timer` | Timer | Periodic or one-shot tick source; configurable delay in microseconds |
| `map` | Map | Transforms JSON using Inja template expressions (C++ template engine) |
| `filter` | Filter | Passes or blocks JSON based on template-matching with AND/OR aggregation |
| `buffer` | Buffer | Accumulates binary or JSON data; emits when a size threshold is reached |
| `cache` | Cache | Stores the most recent value and re-emits it on demand |
| `monitor` | Monitor | Logs pipeline data to console or file; passes data through unchanged |
| `fft` | FFT | Converts a raw audio ring-buffer into a frequency-magnitude array (forward FFT) |
| `ifft` | IFFT | Reconstructs a signal from a frequency-magnitude array (inverse FFT) |
| `transient-detector` | Transient Detector | Detects onsets and transients in an audio stream |
| `wav-reader` | WAV Reader | Reads a WAV audio file from disk and emits its samples |
| `core-input` *(macOS)* | Core Input | Captures live audio from the system microphone via CoreAudio |
| `core-output` *(macOS)* | Core Output | Plays audio to the system speakers via CoreAudio |
| `websocket-reader` | WebSocket Reader | Receives messages from an incoming WebSocket connection |
| `websocket-writer` | WebSocket Writer | Sends messages to an outgoing WebSocket connection |
| `websocket-server` | WebSocket Server | Hosts a WebSocket server and emits each arriving client message |
| `websocket-client` | WebSocket Client | Connects to a remote WebSocket server and emits each received message |
| `http-client` | HTTP Client | Makes HTTP requests and emits the response |
| `http-server` | HTTP Server | Hosts an HTTP server; each incoming request triggers the pipeline |
| `static` | Static | Serves files from a directory over HTTP |
| `filesystem` | Filesystem | Reads from and writes to the local file system |
| `ffmpeg` *(optional bundle)* | FFmpeg | Transcodes and processes media files using FFmpeg |

---

## Next: individual service reference

The sections that follow document each service in depth — its operating
modes, every configuration property, the shape of its input and output
data, and worked examples.

- [Timer](./services/timer.md)
- [Map](./services/map.md)
- [Filter](./services/filter.md)
- [Canvas](./services/canvas.md)
- [Input](./services/input.md)
- [Output](./services/output.md)
- [Fetcher](./services/fetcher.md)
- [Aggregator](./services/aggregator.md)
- [Buffer](./services/buffer.md)
- [Monitor](./services/monitor.md)
- [Injector](./services/injector.md)
- [Stack](./services/stack.md)
- [Sequencer](./services/sequencer.md)
- [Looper](./services/looper.md)
- [TriggerPad](./services/trigger-pad.md)
- [XYPad](./services/xy-pad.md)
- [Camera](./services/camera.md)
- [Hacker](./services/hacker.md)
- [Spotify](./services/spotify.md)
- [GitHub Source & Sink](./services/github.md)
- [Ollama Prompt](./services/ollama.md)
- [FFT / IFFT](./services/fft.md)
- [Audio I/O (Core Input / Core Output)](./services/audio-io.md)
- [WebSocket services](./services/websocket.md)
- [HTTP services](./services/http.md)
- [Filesystem](./services/filesystem.md)
- [WAV Reader](./services/wav-reader.md)
- [Transient Detector](./services/transient-detector.md)
