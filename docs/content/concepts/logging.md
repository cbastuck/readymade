# Logging

What a board recorded about itself — one entry at a time, stitched across every
runtime it spans, kept where it survives with nobody watching.

---

## The problem

A board in the playground is watched. Its services notify, its panels update,
and if something goes wrong the person who built it is looking at it.

A deployed board is not. It receives a webhook at three in the morning, runs
eleven services across two runtimes and a nested pipeline, and produces nothing
— and the question the next morning is *where did that stop*. Nothing that
exists for a watcher can answer it:

- **Notifications are for whoever is attached.** They are dropped when nobody
  is, which is the case a log is for.
- **A runtime's own console answers for its own slice.** A board spans several
  runtimes, possibly on several machines; four separate stdout streams in
  timestamp order are not a trace.
- **The payload cannot say which invocation it belongs to.** The same data flows
  through the same services for entirely unrelated reasons, so attribution needs
  an identity that the data does not carry.

Logging is the answer to all three: **runtimes record, the coordinator keeps**,
and every entry names the run it belongs to.

---

## A run

A **run** is one invocation of a board — one user action, one timer tick, one
arriving message — followed across every service and runtime it reaches.

The ordered service list says what runs; the run says *which invocation it is
running as*. It travels as a `ProcessContext`:

| Field | What it is |
|---|---|
| `runId` | This invocation. Minted where the invocation begins. |
| `parentRunId` | The run this one was invoked *from*, for a nested pipeline. Absent when the trigger came from outside, which is what makes a trace a tree rather than a list. |
| `requestId` | A **reply address**, not an identity: built from a message's sender, alive only while a response is awaited, consumed on resolution. |

`runId` is deliberately not folded into `requestId`. They have different
lifetimes — one run makes any number of awaited calls.

### Where a run begins

At the **origin**, not at the first runtime that happens to need one. Every
entry point into a board mints it: the ▶ control, a facade action, a board's
play, a service calling another runtime by name — in the browser through
`startedRun()` (`hkp-frontend/src/runtime/processContext.ts`), on the other
runtimes through `newRun()` and its equivalents. A context that is already set
is a call being *continued*, and is passed through untouched.

Minting late is what produces a trace that starts with the trigger already lost.

### How it crosses a runtime boundary

A peer that drives a runtime names the run its call belongs to, so a board
spanning several runtimes reads as one trace rather than one per runtime:

- over the WebSocket, as `context` beside `params`,
- over REST, as `__context` in the body,
- read back by `contextFromWire()` (node), `context_from_wire()` (python),
  `ProcessContext::fromJson` (C++).

A caller that names no run is not continuing one, so a run is *begun* rather
than left unidentified. Work attributed to a run of its own is recoverable;
work attributed to nothing is not.

### Nesting, and leaving the call

A nested pipeline gets a run of its own with `parentRunId` set to the run around
it (`childRun`), so work done *inside* a sub-pipeline stays distinguishable from
work done around it.

A service that finishes after its `process` returns — an HTTP response arriving,
a socket pushing — has left its call by the time it has something to pass on. It
captures the context while still inside `process` (`host.currentContext()`) and
hands it back to `processFrom`, which is what keeps the two halves recognisable
as one run. A service that forgets to capture starts a new run instead: its
trace splits in two rather than being misattributed to whichever run happened to
be in flight. **Fragmentation is visible in a trace; misattribution reads as
fact.**

In hkp-node the current run is held in an `AsyncLocalStorage`, not a field: a
timer tick and an arriving message interleave freely across awaits, and a plain
field would let the second overwrite the first's context mid-await.

---

## The entry

One thing worth recording about a run. The same shape on every runtime, because
a board's log is assembled from all of them:

| Field | What it holds |
|---|---|
| `runId`, `parentRunId` | which run, and which run invoked it |
| `ts` | ISO 8601 UTC to milliseconds, `Z`-suffixed, stamped by the runtime that produced it — the store orders and filters by comparing it as text, so a runtime with its own dialect would sort against the others rather than among them |
| `runtimeId`, `serviceUuid` | where it happened |
| `level` | `debug` \| `info` \| `warn` \| `error` |
| `event` | what happened, as a short stable name a reader can group by |
| `data` | optional payload — see below |
| `durationMs` | how long the call took, on `service.processed` |

**A service says only what happened.** It calls `host.log(level, event, data)`;
the run and the service are filled in from the call in progress. It cannot
mislabel an entry, because it never writes those fields.

The exception is `host.forwardLog(entry)`, which passes an entry a nested
pipeline produced outward unchanged — re-deriving its run and service from the
outer call would relabel work done *inside* a sub-pipeline as the work of the
service hosting it, which is the nesting the entry exists to record. A nested
runtime is built from a service's own configuration, which says nothing about
logging, so it asks the runtime around it (`host.logSettings()`) and records the
same.

### What `debug` buys

The runtime itself records the flow: `service.process` before a call,
`service.processed` with `durationMs` after it, `pipeline.stopped` where a
service returned null. All at `debug`.

That is the difference between a log that answers *what did this board report*
and one that answers *where did it stop*. A read defaults to `info` for the same
reason: a caller who did not ask for `debug` is asking what happened, not what
ran.

### `data` is a separate decision

`logging` says whether anything is recorded. `logData` says whether an entry may
carry the payload it is about. They are not the same question — what a board
records about its own flow and what it is willing to write down of the data
passing through it are different decisions — and the switch in the UI touches
only the first. A verbosity control that quietly did both would be an exposure
control.

Reading applies the same rule: `data` is withheld unless explicitly asked for,
because filtering it after it had crossed the wire would defeat the point of
withholding it.

---

## Where entries go

A runtime does not know what a board is; it hands entries to whoever registered
for them.

```
service.log ─▶ runtime ─▶ log targets ─┬─▶ output socket ──▶ coordinator ─▶ log store
                                       └─▶ (browser: bridge) ┘
```

- **A remote runtime** (node, python, hkp-rt) sends `{ type: "log", entry }` on
  the same result socket a notification takes — the connection the board's
  coordinator already holds, authenticated with a credential minted to outlive
  the user's session. The coordinator **writes it before broadcasting it**: a
  browser may or may not be attached, and the log exists for the case where none
  is.
- **A browser runtime** has no socket of its own to the coordinator, so its
  entries travel over the bridge as `log` messages
  (`views/cloud/useCoordinatorBridge.ts`). Those are stored and *not* fanned out
  again: the browser that sent them already has them, and a second browser
  watching the same board is not hosting the runtime that produced them.
- **Off means off.** No entry is built when `logging` is false, when the level
  is below the runtime's floor, or when nothing is registered to receive one —
  so nothing is spent deciding what an entry would have said.

### The store

One JSONL file per board, under `HKP_COORDINATOR_LOG_DIR` (default: beside the
boards), in the same per-user directories as the board store with `0o700` on the
directory and `0o600` on the file — entries carry board data, so they inherit
that posture.

One file per board, holding entries from every runtime it spans, is the whole
reason the log is kept by the coordinator: a runtime could only ever answer for
its own slice.

JSONL rather than a JSON array, for three reasons at once: it appends without
rewriting, a crash mid-write costs the last line rather than the file, and it
reads back a line at a time, so serving a query never loads a long-running
board's whole history into memory. A torn line is skipped and the rest is still
readable.

Bounded by **size**, not age: what fills a disk is bytes, and a board ticking
once a second and one that runs twice a day would need wildly different day
counts to mean the same thing. Past 32 MB the live file rolls aside (`.1`, `.2`,
…) and the oldest of four is dropped. A read spans the live file and the rolled
ones behind it — right after a roll the live file is empty and everything being
asked for is in `.1` — and reads each one **backwards from its end**, because
the newest entries are what a log is asked for.

---

## Reading it, and switching it on

| | |
|---|---|
| Read | `GET /coordinator/users/:username/boards/:boardName/runs?runId=&level=&since=&limit=&withData=` |
| Switch | `POST /coordinator/users/:username/boards/:boardName/logging` `{ enabled, level }` |

Both sit behind the same `auth` + `requireSelf` as every other board route — a
valid token whose `sub` matches the username — and deliberately **not** behind a
runtime session token: that is a machine credential minted to outlive a user's
session, and reading a board's history is not something it should be able to do.

The switch is its own route rather than part of re-registering the board,
because it is a setting a board revisits *while it runs*; registering again
would rebuild every runtime to change one boolean. It is applied to the runtimes
already running (`PATCH /runtimes/:id/state`) **and** written into the stored
config, so it neither restarts anything nor quietly reverts on the next start.
Runtimes that did not take it are reported, not assumed — partly applied is
worth saying out loud.

The setting lives in the board where it can be read back: `state.logging` and
`state.logLevel` on each runtime. The Cloud Boards view reads it from there
rather than keeping it locally, so the toggle shows what the coordinator will
actually do — after a reload, and for a board somebody else switched on.

---

## What each runtime actually does

| Runtime | Records | Sends entries | Takes the live switch |
|---|---|---|---|
| hkp-node | entries + the `debug` flow | result socket | yes (`PATCH /runtimes/:id/state`) |
| hkp-python | entries + the `debug` flow | result socket | yes (`PATCH /runtimes/:id/state`) |
| hkp-rt (C++) | entries + the `debug` flow | result socket | no — set at provision time |
| Browser | entries only | the coordinator bridge | at provision time |

For hkp-rt the level and the on/off come from the runtime's `state` in the board
config, which is why the live switch reports it as *unreachable* and why the
setting still takes effect the next time that board is started.

Note that the switch is a server-to-server call: neither hkp-node nor hkp-python
lists `PATCH` among its CORS methods, so a browser attached straight to a runtime
cannot make it — the coordinator is the caller this route exists for.

---

## Known gaps

- **There is no log viewer.** The Cloud Boards view can turn logging on and
  choose a level; nothing yet reads `/runs` and shows the entries, so today they
  are read over HTTP directly.
- **A playground board records nothing.** Log targets are registered by the
  bridge, so a board that no coordinator holds has nowhere to put an entry.
  Logging is presently a property of a deployed board.
- **The live switch does not reach hkp-rt**, which takes its logging settings
  when the runtime is provisioned (above).
- **No sampling and no rate limit.** `debug` on a busy board rolls its files
  quickly; the bound is on bytes kept, not on entries produced.
- **Nothing correlates a run with an outside request id** — a webhook's own
  identifier is data, not context.

---

## Where it lives in the code

| Concern | Where |
|---|---|
| Entry + context types | `hkp-frontend/src/types.ts`, `hkp-node/src/types.ts`, `hkp-python/src/hkp/types.py`, `hkp-rt/lib/include/log_entry.h`, `hkp-rt/lib/src/process_context.h` |
| Minting a run | `hkp-frontend/src/runtime/processContext.ts`, `hkp-node/src/runtime.ts` (`newRun`, `childRun`, `contextFromWire`) |
| Recording | `hkp-node/src/runtime.ts` (`log`, `logProcessed`), `hkp-python/src/hkp/runtime.py`, `hkp-rt/lib/src/runtime.cpp` |
| Nested forwarding | `hkp-node/src/services/sub-service.ts`, `services/nested-pipeline.ts` |
| Egress | `hkp-node/src/server.ts` (`sendJsonLog`), `hkp-python/src/hkp/server.py` (`_send_log`), `hkp-rt/lib/src/runtime.cpp` |
| Browser leg | `hkp-frontend/src/runtime/browser/BrowserRuntimeScope.ts`, `views/cloud/useCoordinatorBridge.ts` |
| Store | `hkp-node/src/coordinator/logStore.ts` |
| Routes | `hkp-node/src/coordinator/router.ts` (`…/runs`, `…/logging`), `coordinator/session.ts` (`setLogging`) |
| UI | `hkp-frontend/src/views/cloud/index.tsx`, `coordinatorClient.ts` |
| Tests | `hkp-node/tests/board-log.test.ts`, `hkp-rt/tests/runtime_log.test.cpp`, `hkp-python/tests/test_board_log.py`, `test_board_log_socket.py` |

---

See also: **Cloud boards** (`concepts/cloud-boards.md`) for the boards this is
for, and **Coordinator** (`concepts/coordinator.md`) for why the instance that
owns a board is the one that keeps its log.
