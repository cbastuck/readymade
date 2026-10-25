# Capture mode: what a call report carries, and when

Decided 2026-10-25 while reviewing `hardening_5_to_10`. Built the same day: the
size limit, then Capture mode in all four runtimes, the coordinator and the
frontend. What is left is under "Open".

---

## The principle

**What passes between the services of a run is private; only what the board
outputs is public.** That was the idea from the start, and the flow inspector
was quietly breaking it. Every call is bracketed by two reports
(`call-process`, `call-process-finished`), each carrying the value going in or
out. They go to every client watching a runtime and, on a deployed board, to its
coordinator, which always listens (`docs/content/concepts/runtime.md`, "What
crosses a runtime boundary").

So seeing the data is opt-in, and it is never saved anywhere. It is also about
cost. Reports multiply every value by the number of services it passes through,
for a feature used while building a board, not while running a finished one.

Logging already took this stance: whether an entry may carry its payload
(`logData`) is a decision separate from whether anything is logged
(`docs/content/concepts/logging.md`). Capture mode applies the same rule to call
reports.

---

## Decided

1. **A size limit first, built.** A report carries a value only up to 5 MiB.
   Above that, `{"__hkpTooLarge": {type, bytes, exact, preview}}` takes its
   place. It holds even with Capture mode on.
2. **Capture mode is never saved.** It is not in the board document or a
   runtime's stored config, and the coordinator does not persist it. A board
   always opens with it off.
3. **Off: activity only.** The pair of reports is still sent, with its call id
   and no `data`, so the processing indicator and the overview's activity keep
   working.
4. **The same rule in the browser runtime**, though nothing there crosses a
   network: the inspector keeps a cloned history of every value it is shown.
5. **Rerun and Inject are disabled** for a value the inspector holds only a
   description of. Built with the limit.
6. **The dialog**, shown when the inspector is opened with Capture mode off:
   > Recording is off, so the inspector shows that this service ran, but not
   > what it received or passed on. Turn recording on? It takes effect from the
   > next run.

   Its button turns Capture mode on, as the toolbar button does. It is a small
   guide for someone learning Readymade.
7. **Named "Capture mode"**, a button beside the two Play buttons in the
   toolbar. The logging docs' use of "record" stays as it is for now. The
   dialog's wording (6) was adapted to the name when it was built: "Capture
   mode is off, so the inspector shows that this service ran, but not what it
   received or passed on. Turn Capture mode on? It takes effect from the next
   run."

Not in conflict with `TODO-DEBUGGING.md`, which rejected a trace mode (a rolling
log of past call pairs). Capture mode keeps nothing. It only decides what a
report carries at the moment it is sent.

---

## Built: the size limit

The same rule in all four runtimes, each with tests of the same cases:

| Runtime | Rule | Applied in | Tests |
| --- | --- | --- | --- |
| Browser | `hkp-frontend/src/runtime/callReport.ts` | `runtime/serviceState.ts` | `runtime/tests/call-report.test.ts` (also pins it identical to hkp-node's copy) |
| hkp-node | `src/callReport.ts` (identical twin) | `src/runtime.ts`, the four report sites | `tests/call-report.test.ts` |
| hkp-python | `src/hkp/call_report.py` | `src/hkp/runtime.py`, the three report sites carrying data | `tests/test_call_report.py` |
| hkp-rt | `lib/include/call_report.h` | `lifecycleNotification` in `lib/src/runtime_host.h`, which `Runtime` and `SubRuntime` both use | `tests/call_report.test.cpp` |

- **Measuring stops at the limit**, so a 100 MB value costs no more to judge
  than one of 5 MiB. `exact` is false where it stopped. Text and bytes are
  exact where that is cheap. JSON never is.
- **Only plain objects and arrays are looked inside.** An instance may hold a
  whole graph, sometimes in a cycle, and is counted as small and opaque.
- **The inspector** (`FlowInspectorPopup.tsx`) shows the description's preview,
  read-only, with a note saying what the value was. Its history line names it.
- **Docs:** `docs/content/concepts/runtime.md`, "What crosses a runtime
  boundary".

---

## Built: Capture mode

**Where it is applied** — where a report leaves, so a pipeline nested at any
depth follows the runtime that holds it:

| Runtime | The switch | Applied in | Tests |
| --- | --- | --- | --- |
| Browser | `runtime/captureMode.ts`, a store for this window | `runtime/serviceState.ts`, through `outgoingPayload` | `runtime/tests/call-report.test.ts` |
| hkp-node | `HostedRuntime.setCapture`, set by `applyRuntimeState` | `server.ts`, the notification socket and the coordinator link, through `outgoingPayload` | `tests/flow-notifications.test.ts` (a real server and socket), `tests/call-report.test.ts` |
| hkp-python | `HostedRuntime.set_capture`, set by `_apply_runtime_state` | `server.py`, the same two exits, through `outgoing_payload` | `tests/test_call_report.py` (a real server and socket) |
| hkp-rt | `Runtime::setCapture`, set by `App::setRuntimeState`; `RuntimeHost::capturesCalls`, which `SubRuntime` asks of its parent | `lifecycleNotification`, where a report is made | `tests/runtime_context.test.cpp`, `tests/service_scopes.test.cpp`, `tests/call_report.test.cpp` |

- **The report without Capture mode:** `{state}`, plus `stopped: true` on a
  `call-process-finished` whose call passed nothing on. Without that flag the
  overview would read every call as one that stopped.
- **Never saved.**
  - Every runtime answers `capture` from `PATCH /runtimes/:id/state` and the
    coordinator's `setState`, and nothing builds a runtime with it. A board's
    own runtime `state` cannot switch it on: creation never applies state.
  - The playground turns it off when a board is opened and when it is left
    (`PlaygroundController`).
- **Remote runtimes in the playground:** `RuntimeRestScope.followCapture`
  tells its runtime once the socket opens, off included, and on every change
  until the scope closes. Tested in `runtime/rest/tests/capture-follow.test.ts`.
- **A deployed board:**
  - `POST /coordinator/users/:username/boards/:boardName/capture`, the owner's
    alone (`requireSelf`).
  - `BoardSession.setCapture` applies it over `setState`, and again to a runtime
    it rebuilds while on. It writes nothing to the config and persists nothing.
  - The owner's last bridge closing turns it off. The board list reports
    `capture`.
  - The Cloud Boards view has the owner's toggle beside Logging, and keeps the
    browser runtimes it hosts in step.
  - Tested in `tests/coordinator-log-route.test.ts`.
- **The coordinator keeps none of it.** A notification is delivered to the
  bridges and not stored; the only thing kept from one is a published mount
  address (`onRuntimeNotification`).
- **UI:**
  - The Capture button in `PlayBoardControls` (`aria-pressed`, red when on).
  - The dialog in `ServiceOutputPlug`, shown when the inspector is opened with
    Capture mode off. Either answer opens the inspector.
  - `ServiceFrame` keeps no history from a report without a value, and still
    lights the plug unless the call stopped. `overview/activity.ts` likewise.
  - Tests: `flow-inspector.test.tsx`, `play-board-controls.test.tsx`,
    `overview/tests/activity.test.ts`.
- **Docs:** `docs/content/concepts/runtime.md`, "What crosses a runtime
  boundary"; `docs/content/concepts/cloud-boards.md`, beside the log switch.

## Open

- **A pass by hand** in the playground and on a deployed board:
  - the button and the dialog;
  - a remote runtime's frames filling only while captured;
  - a deployed board's toggle, and closing the tab ending it.

  `e2e/tests/blocks.spec.ts` now answers the dialog before it expects the
  inspector, but the E2E suite was not run.
- **Other notifications that carry pipeline data.** A Monitor shows what
  passed through it, and an error message can quote a value. Capture mode
  covers call reports, not what a service chooses to say. Each needs a
  decision: a service whose job is to show data (Monitor) arguably is the
  opt-in, while an incidental copy of a value is not.
- **Two windows on one remote runtime.** Each tells the runtime its own Capture
  mode when it attaches and when it changes. The last to speak wins.
- **The vocabulary** has no entry for Capture mode yet; it is written by hand.
