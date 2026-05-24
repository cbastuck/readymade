# HKP — Architecture & Philosophy

HKP is a composable, distributed app framework for building **interactive apps** — things
users open, configure, and use in real time — not automation pipelines. Think what Reaktor is for buolding
synths, but HKP targets app of any domain, running across runtimes and machines. Services are the building
blocks; boards are the apps you build with them.

---

## Core concepts

### Board

The top-level container. Everything lives on a board. Boards have names and may be associated
with a user account, but this is not required — the playground (hookitapp.com/playground) and
Meander app (macOS + iOS) run boards locally in the browser with no backend. There is
currently no cloud persistence; boards live in the browser.

### Runtime

A board contains one or more runtimes. Runtimes are **chained** — the output of one becomes
the input of the next. Each runtime owns an ordered list of services; that order is the wiring.

| Runtime             | Language   | Communication                       | Use it for                                       |
| ------------------- | ---------- | ----------------------------------- | ------------------------------------------------ |
| Browser             | TypeScript | Direct JS call (same process as UI) | UI interaction, fast iteration, most services    |
| Node.js (hkp-node)  | TypeScript | REST                                | Messaging (Telegram, SMTP, IMAP), server I/O     |
| Python (hkp-python) | Python     | REST                                | AI/ML workflows, open-source model inference     |
| C++ (hkp-rt)        | C++        | REST                                | Audio (FFT, WAV, ring buffers), high-performance |
| Go (hkp-go)         | Go         | REST                                | (in development)                                 |
| GraphQL             | —          | GraphQL                             | Legacy; used in one integration                  |

Not all services exist on all runtimes.

### Service

The unit of work. A service sits inside a runtime, accepts data on its input, and produces
data on its output. Services:

- Have a **configure** method called on load and whenever the user changes state or mode
- Have a **process** method called with input data from the previous service, or `undefined`
  if no prior output exists
- Can have multiple **modes** that change how they process data
- Expose an optional **UI panel** (ServiceUI) for interactive configuration; a generic panel
  is shown for services that don't provide one
- Can **emit data autonomously** without receiving input (e.g. Timer)

For browser services, the service and its UI share the same JS process — state sync is a
direct method call. For remote runtimes (Node, Python, C++), the UI communicates via REST;
use **optimistic UI** patterns and sync state through `configure` + `getState`.

### Nesting

Every runtime supports a **SubService** — a service that contains its own ordered pipeline.
This is the primary mechanism for reusable higher-level building blocks.

---

## Data flow model

### Push (normal)

The runtime calls each service in order, passing the output of N as input to N+1. The first
service in the first runtime receives whatever triggered the board (user action, timer tick,
incoming HTTP request, etc.).

### Stopping propagation

Return `null` (or `Null` data type) to signal "nothing to pass on." The runtime stops and
does not call subsequent services or the next runtime.

### Early return (skip)

Return a result early to skip all services that follow in the same runtime. Example: a cache
on a **hit** returns the cached value immediately, bypassing the services that would have
fetched it.

### Inversion of control (pull)

Return `null` to stop the runtime's push, then **asynchronously call the subsequent services
yourself** and act on their results. This shifts the service from passive (reacting to input)
to active (pulling from downstream). Example: a cache on a **miss** lets the downstream
services fetch the value, captures their result, stores it, then emits it to the next runtime.

---

## Data types

Types are shared across runtimes:

| Type                  | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| `FloatRingBuffer`     | Contiguous float samples with ID + timestamp — the audio type         |
| `JSON`                | Arbitrary structured data (nlohmann::json in C++, plain object in JS) |
| `BinaryData`          | Raw bytes (`std::vector<uint8_t>` / `Uint8Array`)                     |
| `String` / `TextData` | Plain text                                                            |
| `MixedData`           | Binary payload + JSON metadata together                               |
| `Null`                | Signals stop / no output                                              |
| `ControlFlowData`     | Early-return signal, carries result to skip remaining services        |
| `Undefined`           | Uninitialized / not yet set                                           |

**YAS (Yet Another Serialization)** is the binary wire format for non-textual data over REST.
7-byte header (`yas` magic + version/type/endian flags) followed by a type-prefixed payload.

- `hkp-frontend/src/runtime/rest/Message.ts` — serialization/deserialization
- `hkp-frontend/src/runtime/rest/Data.ts` — TypeScript type definitions
- `hkp-rt/lib/include/types/data.h` — C++ type definitions
- `hkp-go/types/data.go` — Go type definitions

---

## Board JSON format

```json
{
  "boardName": "string",
  "runtimes": [
    { "id": "ui", "name": "Browser", "type": "browser", "state": { "wrapServices": false } },
    { "id": "node", "name": "Node", "type": "rest", "url": "http://127.0.0.1:8080", "state": { "wrapServices": false } }
  ],
  "services": {
    "ui":   [ { "uuid": "my-svc", "serviceId": "hookup.to/service/timer", "serviceName": "Timer", "state": {} } ],
    "node": [ { "uuid": "proc-svc", "serviceId": "monitor", "serviceName": "Monitor" } ]
  },
  "facade": { ... }
}
```

Runtime order = chain order. Services within a runtime are ordered top-to-bottom; that order
is their wiring. Use `"HKP_RUNTIME_HOST"` as a placeholder in remote URLs when the host
isn't known at design time.

---

## Facade layer

A board can define a **facade** — a JSON document that presents a polished, app-like
interface of controls and displays on top of the board. Developers build the internals;
the facade makes the result usable by people who don't know or care about services. Type
definitions live in `hkp-frontend/src/facade/types.ts`.

```json
{
  "layout": "single | columns",
  "panels": [{ "id": "string", "title": "optional", "layout": { ...LayoutItem } }]
}
```

A **LayoutItem** is either a container (`{ "direction": "row|column", "items": [...] }`)
or a widget leaf with a `"type"` field. Widgets reference services by `serviceUuid`.

| Widget type | What it does |
|---|---|
| `button` | Sends a configure payload to a service on click |
| `text-input` | Text field; `$$input` in the configure payload becomes the typed value |
| `knob` | Rotary control; `{{value}}` in configure payload becomes the numeric value |
| `level-meter` | Vertical bar driven by a service notification |
| `canvas` | Embeds a Canvas service's drawing surface |
| `xy-pad` | Embeds an XY Pad service |
| `qr-code` | Displays a QR code from a service notification |
| `message-list` | Scrolling message thread with optional inline composer |
| `status-indicator` | Coloured dot driven by a service notification |
| `file-pick` | File chooser that sends the file to a service |

Use `/new-board` for the full widget schema and board design workflow.

---

## Where things live

```
hkp-frontend/          React app — playground UI, board engine, all browser services
  src/runtime/browser/   Browser runtime and services
  src/runtime/rest/      REST runtime client + YAS serialization
  boards/                Board JSON files (demo boards, example configs)
  docs/                  Documentation site content

hkp-rt/                C++ runtime (audio, high-performance services)
  lib/src/services/      Service headers
  lib/src/registry.cpp   Service registry (TypeList)
  config/                Example runtime config JSONs

hkp-node/              Node.js runtime (messaging, server I/O)
hkp-python/            Python runtime (AI/ML)
hkp-go/                Go runtime (in development)
meander/               Desktop + iOS app wrapping the board engine
meander-ios/           iOS-specific native layer
```

---

## Claude skills (slash commands)

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `/new-board`           | Design a complete board — runtimes, services, wiring, facade |
| `/new-browser-service` | Scaffold a browser runtime service end-to-end                |
| `/new-node-service`    | Scaffold a Node.js runtime service end-to-end                |
| `/new-cpp-service`     | Scaffold a C++ hkp-rt service end-to-end                     |

When implementing a service, always produce: service logic, service UI (if interactive),
registry registration, tests, demo board, and docs page. The demo board filename
`<slug>-demo-board.json` is automatically linked from the docs UI.

---

## Design principles

- **Composable first.** Services combine into sub-pipelines, sub-pipelines into boards,
  boards into apps — like crafting. When designing a service, ask: can this be composed with
  others to make something more useful than the sum of its parts?
- **Structured flow over wires.** Explicit wires are like `goto` — they work but make flows
  hard to reason about. HKP has no wire UI; the ordered service list _is_ the flow. Express
  branching and iteration through control-flow services: a Switch that pattern-matches and
  routes into sub-pipelines, a Filter that stops propagation on a failed predicate, a Looper
  that repeats sub-services until a predicate stops it.
- **Scoped by concept, not by technique.** A service groups related logic by domain, not by
  implementation. Multiple modes and technologies belong together if they serve the same
  conceptual role (e.g. Input handles event streams and WebSockets — different tech, same
  idea). Complexity lives in composition, not inside individual services.
- **Observable.** Every service has inspectable state and a UI panel. Nothing is a black box.
- **Working and iterable over optimal.** The goal is something you can interact with, adjust,
  and hand to an AI to evolve — not a perfectly architected solution that is hard to change.
- **AI-collaborative.** The decomposed architecture lets AI generate or modify a single
  service without understanding the whole system. Builders stay in control at the concept
  level even without knowing every implementation detail.