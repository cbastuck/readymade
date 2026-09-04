# Queue — state and what is left

Working notes from the SYN booking/hotels split (Aug–Sep 2026). The `queue`
service is built and tested on `topic_business_use_case`; board **units** are a
separate feature on their own branch, and the queue is deliberately usable
without them.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design

---

## What exists

| | Where | Status |
| --- | --- | --- |
| `queue` service — publish / consume / ack / fail / list | `hkp-node/src/services/queue.ts` | ☑ |
| Queue table + the five operations, as a module | `hkp-node/src/services/queue-store.ts` | ☑ |
| Owner-wide store `openShared` → `<sha256(owner)>/shared.db` | `hkp-node/src/services/database.ts` | ☑ *(to be removed — see below)* |
| `database` field naming a board's file, on `sql` and `conversations` | those services | ☑ |
| `PRAGMA busy_timeout`, tolerated WAL-conversion race | `database.ts` | ☑ |
| Multi-process regression test (spawns real processes) | `tests/database-processes.test.ts` | ☑ |
| Docs | `docs/content/services/queue.md`, `sql.md`, `conversations.md` | ☑ |
| Demo board | `hkp-frontend/boards/queue-demo-board.json` | ☑ |

Tests: `tests/queue.test.ts` (20), `tests/database.test.ts`,
`tests/database-processes.test.ts`. The one failing test in the suite,
`syn-board.test.ts > does not record a send that did not happen`, is unrelated
and pre-existing (expects the send-mail error to say "required"; it says "not in
allowedRecipients").

---

## Next change — remove the queue's special case

`openShared` only existed because a board could not name a database. It can now.

- ☐ Give `queue` the same `database` field `sql` and `conversations` have.
- ☐ Delete `DatabaseStore.openShared` and the owner-wide `shared.db`.
- ☐ Drop `shared` from `RESERVED_NAMES` in `database.ts`.
- ☐ Update `queue.md` ("Which queue a `queue` sees") and the demo board.

The queue then becomes an ordinary table in a database both sides name — no
owner-wide file, no reserved name, and two units sharing a queue works exactly
the way two units sharing any other table works.

---

## Cross-machine — open, not blocking

Two hkp-node **processes on one machine** share a filesystem, so a named
database is shared and everything above works. **Two machines** do not (and
SQLite over NFS is not a foundation worth building on).

Facts established while looking at this:

- There is **no runtime→runtime and no runtime→coordinator channel.** The
  `/coordinator/bridge` WebSocket is coordinator ↔ **browser**; the per-runtime
  socket is opened *by a client* to a runtime for notifications.
- The **coordinator** reaches runtimes over REST with a **session token per
  runtime** (`POST /runtimes/:id/session-token`, `coordinator/session.ts`).
- Therefore a service inside a runtime holds no credential and cannot get one.
  A `sourceToken` on the queue service was the wrong shape and was removed.

✎ If cross-machine is wanted: **the coordinator makes the claim**, using the
session tokens it already holds, resolving a topic to the runtime that hosts it.
Cost: the coordinator is in the path, so a claim happens only while it is up —
a missed tick, which is consistent with the framework's existing at-most-once
runtime handover. Do **not** give runtimes credentials for each other.

A `POST /queue` route + `source`/`sourceToken` fields were built and then
removed; see git history on this branch if the shape is ever wanted back.

---

## Decisions this rests on

- **No `workflow` entity.** Board stays the topmost entity. See
  `TODO-WORKFLOW-PLATFORM.md` and the board-units branch.
- **Nobody dispatches.** A board *pulls* — a `consume` behind its own `timer`,
  the shape `poll` already has. Push would be a wire between boards.
- **Publish before you commit.** A failed publish stops the pipeline, so the
  state change saying the message was sent must come *after* it. The board's own
  timer is the retry; the framework needs no outbox. This is why the SYN
  `request-quotes` action publishes inside the action pipeline, before
  `advance` writes the transition.
- **Fault tolerance belongs in boards, not the framework.** A call that cannot
  arrive does not arrive; the runtime handover already works this way.
- **Split on time boundaries, not file size.** A queue is for two sides on
  different clocks. Two things in the same second belong in one pipeline, nested
  for readability.
- **Address the runtime, name the topic** — never a board or service uuid,
  which would couple a producer to a consumer's internals.

---

## Traps worth remembering

- **A board's database is keyed on its title** unless `database` names one. Two
  boards sharing a title share their tables; renaming a board switches it to a
  different, empty file while its data stays under the old title's name. The
  **owner** half is derived from the token and is the real boundary.
- **Concurrent writers need `busy_timeout`.** Measured on two processes writing
  one file: 510 of 800 writes lost without it, 0 with it.
- **`journal_mode = WAL` on a brand-new file races** between processes and the
  loser throws `database is locked`; the mode belongs to the file, so losing is
  fine.
- Board JSON edited on disk needs a **re-import** — the loaded board lives in
  the browser.

---

## Board files

`hkp-frontend/boards/syn-booking-unit-board.json` and
`syn-hotels-unit-board.json` carry `unit: { name, units, imports, exports }`
blocks that nothing reads yet. Both currently point at `127.0.0.1:8080` and name
their databases (`syn-booking`, `syn-hotels`). They belong with the board-units
feature rather than with the queue — move or leave them as fixtures for that
branch. The queue itself needs neither.
