# Capture mode: what a call report carries, and when

Decided 2026-10-25 while reviewing `hardening_5_to_10`. The size limit below is
built; Capture mode itself is not.

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
   toolbar. The logging docs' use of "record" stays as it is for now.
   **Open:** the dialog's wording (6) still says "Recording"; align it with the
   name when building.

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

## To build: Capture mode

**The switch.**
- A toolbar button beside the Play buttons (`components/Toolbar/`), on or off,
  for the whole board.
- It is session state in the playground, never part of `BoardDescriptor`, and
  never written by `serializeBoard`.

**Reaching the runtimes.**
- Logging's live switch already reaches running runtimes without rebuilding
  them (`PATCH /runtimes/:id/state`; `docs/content/concepts/logging.md`, "Reading
  it, and switching it on").
- Capture mode should use the same path, with one difference: **logging writes
  its setting into the stored config, Capture mode must not.**
- A runtime starts with it off: a fresh one, a restarted one, one a
  coordinator restores.

**What each runtime does with it.** At the same sites the size limit uses: off
means no `data` in the report, on means `reportedValue(data)`.
- Browser: `serviceState.ts`. The switch has to reach the scope, nested scopes
  included.
- hkp-node: `runtime.ts`. Nested pipelines are `HostedRuntime`s of their own
  and must inherit it.
- hkp-python: `runtime.py`, the same arrangement.
- hkp-rt: `Runtime` and `SubRuntime`, through `lifecycleNotification`.

**A deployed board.** The owner may switch it on while attached. It is not
stored, so a coordinator restart or a redeploy turns it off. A member cannot
switch it on, and never receives call reports anyway (`facadeForMembers`).

**The inspector.** With Capture mode off, opening it shows the dialog (6) and
then the activity. A report without `data` adds nothing to either history.

**Docs.** `docs/content/concepts/runtime.md` says, in "What crosses a runtime
boundary", that attaching a UI makes a runtime report its internal traffic.
That becomes "while Capture mode is on". `vocabulary.md` gets the term once it
is built; the vocabulary is written by hand.

---

## Open

- **Other notifications that carry pipeline data.** Call reports are the
  systematic case, but some services report data in their own notifications:
  a Monitor shows what passed through it, and an error message can quote a
  value. The principle covers those too. Each needs a decision: a service whose
  job is to show data (Monitor) arguably is the opt-in, while an incidental
  copy of a value is not.
- **A time limit on a deployed board**, so a switch left on turns itself off
  (say after 15 minutes). Optional.
- **The coordinator's own copy.** It keeps the last state each service
  reported. Check that a call report's `data` never lands there, so that
  turning Capture mode off leaves nothing behind.
