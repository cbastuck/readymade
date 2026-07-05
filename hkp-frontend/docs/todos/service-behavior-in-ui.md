# TODO: Services whose runtime behavior lives in their ServiceUI

**Status:** in progress — PeerSocket fixed; others pending individual assessment.
**Priority:** medium (a latent correctness bug that surfaces on mobile).

## Problem

Some browser services implement their **core runtime behavior** — maintaining a
connection, capturing a device, sourcing data the service depends on — inside
their React `*UI.tsx` component (via `useEffect`, refs, or callbacks the UI
registers on the service) rather than inside the service class itself.

This works on **desktop** only by accident: the desktop playground keeps every
service's UI panel mounted on the canvas, so the effects always run. The
**mobile** playground mounts panels lazily (only when you open the ServiceUI
sheet — see `src/views/playground/mobile/MobilePlaygroundInner.tsx`), so the
behavior never starts, or silently dies, when the panel isn't open.

It also violates the HKP contract independent of mobile: a service is meant to
be the unit of behavior and to work **headless** (a generic panel is shown when
a service provides no ServiceUI, and remote runtimes have no React UI at all).
A service that only functions while its panel is open is broken by that
contract, not just on small screens.

**The fix pattern** (see the PeerSocket reference below): move the side-effecting
runtime behavior into the service (or a plain-TS helper the service owns).
Establish it lazily on the first `configure()` — never in the constructor, so the
service can be instantiated without side effects (the module contract test
constructs every service, and jsdom provides a real `WebSocket`, so a socket
opened in the constructor would fire real network I/O in tests) — and tear it
down in `destroy()` (invoked on service removal and runtime teardown,
`src/runtime/browser/BrowserRuntimeScope.ts`). The UI becomes a pure view that
reflects notifications and issues `configure()` calls.

**Both insertion paths must configure the service**, or the side effect won't
start until the user next edits config:

- **Restore** (loading a saved/shared board) → `BrowserRuntimeApi.restoreRuntime`
  → `configureService(persistedState)`. Already covered.
- **Interactive insert** (dragging a new service in) →
  `serviceOperations.addService` (`src/core/serviceOperations.ts`). This only
  configured *duplicated* services (those with a `prototype`); a brand-new
  service got no initial `configure`. It now also configures fresh browser
  services with `configure({})` so their `configure()` side effect runs on
  insert. (These are separate add paths, so restored services are not
  double-configured.)

## Done — reference implementation

### PeerSocket ✅

`src/runtime/browser/services/PeerSocket.tsx` +
`src/runtime/browser/services/PeerConnection.ts` (new helper) +
`src/runtime/browser/services/PeerSocketUI.tsx` (reduced to a view).

The live PeerJS connection previously lived in the `<Peer>` component and the
`PeersContext` provider (both now deleted — they were used only by PeerSocket).
It now lives in a plain-TS `PeerConnection` the service owns: the service
forwards inbound data to `app.next`, sends outbound in `process()`, re-syncs on
`configure()` and bypass changes, and closes in `destroy()`. `resolveActivePeerHost`
is shared so the UI's displayed server + peer-list fetch agree with the service's
connection.

## Pending — assess risk individually before changing

### Camera — HIGH

`src/runtime/browser/services/Camera.ts` + `CameraUI.tsx`.

The service's snapshot/`process()` depends on a `Screenshooter` callback the UI
registers via `registerScreenshooter` (`CameraUI.tsx:70`). `getUserMedia`, the
`MediaRecorder`, and the `<video>` element all live in the UI. Headless (panel
never opened), `_shooter` is `null`, so `process()` returns its input unchanged
and `triggerSnapshot` produces nothing — the service is inert.

Same class as PeerSocket but higher effort: a camera needs a video element to
decode frames and a permission grant. A proper fix has the service own the
stream plus an offscreen `<video>`/`<canvas>` decoupled from the panel; consider
permission/lifecycle (when to actually open the camera) carefully. Backwards
compat: board JSON/state shape need not change.

### SpeechSynth — MEDIUM

`src/runtime/browser/services/SpeechSynth.ts` + `SpeechSynthUI.tsx`.

The service's `voices` list is the source of truth for voice selection, but it
is populated **only** by the UI, which polls `speechSynthesis.getVoices()` and
pushes the result via `configure({ voices })` (`SpeechSynthUI.tsx` ~line 57/70).
Headless, `voices` stays `[]`, so a configured voice can't be resolved (speech
may still fall back to the browser default).

Fix: have the service populate voices itself from `speechSynthesis.getVoices()`
+ the `voiceschanged` event; the UI just reflects them.

### Injector — LOW (review, likely acceptable)

`src/runtime/browser/services/InjectorUI.tsx:227` calls
`service.app.next(service, result)` directly from a `FileReader` handler,
pushing pipeline data straight from the UI and bypassing the service. Injection
is inherently a user action taken from the panel, so this may be acceptable by
design, but the direct `app.next` from the UI is a layering smell worth
revisiting when the injector is next touched.

## Verified NOT affected

Checked and confirmed the runtime behavior already lives in the service (or the
UI effect is a genuine, interaction-only widget concern):

- **Timer** — owns its `setInterval` + `app.next` in `base/Timer.ts`. (TimerUI's
  `setInterval` is just a `useState` setter shadowing the global name.)
- **MicrophoneMonitor** — owns `getUserMedia`, `AudioContext`, analyser, and the
  sampling interval in `MicrophoneMonitor.ts`.
- **Aggregator**, **TickRuleDelta** — the `setInterval` match is `useState`
  shadowing, not a real timer.
- **XYPad**, **AudioEditor** — pointer/keyboard listeners are on the widget's own
  canvas/element; they are interactive controls that are only meaningful while
  visible.
- **BoardService** — `setTimeout` fetches a board on user selection; UI-driven
  orchestration, not autonomous behavior.

## How this list was produced

Grep over `src/runtime/browser/services/*UI.tsx` for `new WebSocket` /
`EventSource` / `new Peerjs` / `RTCPeerConnection`, `setInterval` / `setTimeout`,
`addEventListener`, and device access (`getUserMedia`, `AudioContext`,
`MediaRecorder`, `navigator.`), then reading each candidate's service file to
decide whether the service or the UI owns the behavior. Re-run that sweep when
auditing again.
