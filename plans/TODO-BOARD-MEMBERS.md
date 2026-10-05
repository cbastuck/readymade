# Board members: a deployed board other people can use

Status: **built 2026-10-05, all six phases; not yet run by hand.** Proposed
and revised the same day after a review. The direction was agreed while looking
at `boards/court-booking-demo-board.json`. The section marked *decided* is what
the conversation settled; the design below it is what was built, with the
differences listed under *As built*. How it works now is in the docs —
`docs/content/concepts/cloud-boards.md` ("Who began a run", "Sharing a board:
members"), `services/sql.md` ("Who is calling") and the board's page.

What is left before this plan can be deleted: the **two-person pass by hand**
(two accounts, one deployed board, each sees their own "mine", neither can book
as the other, a removed member is dropped) and the open questions below.

### As built

- **The facade-`process`-fails-today check was made by reading, and it was
  worse than the plan said.** A scope attached through a coordinator exposed
  no `app`, so a facade widget on an attached board found its service and
  never heard it; and the desktop cloud view renders no facade at all. The
  first is fixed (`bridgeRuntimeApi.ts`); the second is why members get a view
  of their own (`views/cloud/SharedBoard.tsx`) instead of the owner's.
- **A process result continues the chain.** `processService` over a link
  answers "accepted" and the pipeline's result follows as the runtime's
  ordinary `result`, so the coordinator carries it to the next runtime.
- **A sequence number per bridge**, not per session: a member is sent a subset
  of the increments, and a shared count would read to them as gaps.
- **Close code 4403** ends a removed member's bridge, and the client stops
  reconnecting on it. Somebody never admitted is closed the way an unknown
  board is, after the same wait.
- **`$user` needed somewhere to be shown**: the `text` widget gained `value`,
  taking `{ "$user": … }` or `{ "$state": … }`.
- **The invite link is `/cloud-boards?shared=<coordinator>&owner=…&board=…`**,
  handled by the cloud view itself so both hosts get it without a new route.
  On mobile, shared boards are listed and opened; the link is desktop only.
- **Limits are environment variables** on the coordinator
  (`HKP_COORDINATOR_MAX_MEMBERS`, `…_MAX_MEMBER_BRIDGES`,
  `…_MAX_MEMBER_PROCESS_PER_MINUTE`).
- **hkp-rt carries the caller across the link, into its log and from its REST
  and socket routes**, but its sub-pipelines run without a context of their
  own, so there is no nested run to inherit into there.
- **An unverified email is no longer copied into an identity** (hkp-node and
  hkp-python). One existing hkp-python test pinned the old behaviour and was
  changed.

A deployed board already has an owner — the coordinator keeps `userId` beside
each board, and builds its runtimes in that person's tenant. What is missing is
**other people**: a list of members who can attach to the owner's board and use
its facade, nothing else, and every action a person takes reaching the services
**carrying who took it**, stated by the server that verified their token rather
than by the payload.

Companions: `TODO-CLOUD-COORDINATOR.md` (why a coordinator owns a deployed
board), `TODO-COORDINATOR-CONNECTIONS.md` (participants, tickets, the bridge),
`docs/content/concepts/cloud-boards.md` (how it works today).

---

## The problem

The court-booking board has a **Who you are** tab: a text field holding an
email, kept in facade state and sent as `member` with every action. Three
things are wrong with that once the board is used by a club rather than shown
as a demo:

1. **Anyone can be anyone.** The SQL trusts the `member` the payload carries.
   Limiting who can open the board does not change that — a member can still
   book, or give back, in another member's name.
2. **Used directly, the board is not shared.** hkp-node namespaces runtimes and
   SQL databases by the authenticated `sub` (`sql.ts` opens `scope.owner`'s
   database). Two people opening this board against one server each get their
   own `tennis` database. Only a *deployed* board is one runtime in one tenant.
3. **Only the owner reaches a deployed board.** The coordinator's board routes
   sit behind `requireSelf` (`coordinator/router.ts`), and the bridge closes on
   a `connect` whose `userId` is not the token's `sub` (`index.ts`).
   `ALLOWED_EMAILS` gates a whole server, not a board.

Facts found on the way, which this work has to fix because it depends on them:

- **A facade `process` action does not go through the coordinator.** The bridge
  protocol has `configureService` and no process message. On an attached board
  `processService` in `hkp-frontend/src/facade/boardServices.ts` falls through
  to a `fetch` against `runtime.url`, or does nothing when there is no `url`.
  *Read from the code, not yet reproduced in the app.*
- **A run's context does not survive a hop.** A participant's `result` carries
  only `data`, and `routeResult` calls the next runtime with no context
  (`session.ts`). Anything riding the context is known to the first runtime and
  lost to the second.
- **Everything a board says goes to everyone attached** — notifications, log
  entries, the full config and every service's state. Fine while every bridge
  is the owner.
- **Browser-runtime work is fanned out to every bridge**, whatever runtimes it
  said it hosts, and the first reply advances the chain.

---

## Decided

- **The server names the member.** Who took an action comes from the token the
  server verified, never from the request body.
- **One owner, a list of members.** The owner's tenant holds the data. Whoever
  is on the list may use the board; the list *is* the membership.
- **Members are invited by verified email**, lowercased and trimmed as
  `isEmailAllowed` already does.
- **Other members do not see emails.** What is shown on a taken slot is a
  display name.
- **The typed field stays for the cases with no identity** — auth off, and the
  browser-only variant of the board.
- **Bookings are keyed by email** — it matches the list and reads well in the
  table. The review argued for `sub`, on the grounds that a changed address
  orphans a booking and frees a second hour; the risk was judged small for
  bookings that live a week, and `sub` has a failure of its own (one person,
  two ways of signing in, two `sub`s behind one listed email). Confirmed
  2026-10-05.

---

## Design

### 1. The caller travels with the run

`ProcessContext` (`hkp-node/src/types.ts`) gains an optional `caller`:

```ts
caller?: { sub: string; email?: string; name?: string };
```

`email` is present only when verified. `name` is the name the board's list
gives that email, and absent elsewhere.

**Three ways a run begins, three explicit code paths** — not one parser with a
flag:

| Entered by | Run metadata (`runId`…) | Caller |
| --- | --- | --- |
| A client holding a token: `POST /runtimes/:id`, `POST …/services/:uuid/process`, and the runtime **WebSocket's** `processRuntime` | kept, as today | whatever the wire says is **discarded**, then set from the verified token |
| A coordinator, over a participant link | kept | taken as stated — the link is the board's own |
| Nobody: a timer, a mount request, a service emitting by itself | new | none |

`contextFromWire` stays as it is and never learns about `caller`; the trusted
path gets a reader of its own. Auth off (`sub` is `anonymous`) is *no caller*,
not a caller called anonymous — otherwise everybody on a dev machine is the
same person.

**The context survives the chain.** A participant's `result` becomes
`{ data, context }`; the coordinator hands that context to the next runtime;
a browser-runtime round trip returns the one it was given. Without this the
caller is known to the first runtime of a board only. Nested runs inherit it
through `childRun`.

### 2. `sql` binds the caller

Reserved parameter names, bound from the run's caller and never from the
input: `$caller_email`, `$caller_name`, `$caller_sub`. Each is
`NULL` when there is no caller or the value is missing. An input field of the
same name is ignored.

Reserved in the service rather than stamped by a service placed in front,
because a stamp can be walked around: a process call that enters the pipeline
*at* the SQL service never passes it.

The browser runtime's `sql` binds the same names from the signed-in user of the
app. Nothing verifies that — the browser is the person — and the docs say so.

### 3. Process goes over the bridge

Independent of members, and needed before them.

- **Bridge, browser → coordinator:**
  `{ type: "processService", requestId, runtimeId, serviceUuid, payload }`,
  answered with the existing `response` — accepted, or why not. What the
  pipeline produced arrives as notifications, as always.
- **Participant op:** `{ op: "processService", serviceUuid, params, context }`
  — "begin at this service", what the REST route does with `processAt`.
- **Frontend:** `processService` in `facade/boardServices.ts` asks the bridge
  when the scope is a coordinator's, and dials nothing.

hkp-python and hkp-rt participants answer the op with an error naming it until
they implement it (phase 6).

### 4. Members

**The list.** On the coordinator, beside the board, never in the board
document: entries of `{ email, name }`, one per email. The owner sets the name. A name
from the token would be the member's own choice — a way to appear as someone
else on the court grid — and neither `AuthenticatedUser` nor the frontend's
`User` carries one today. Stored in `PersistedBoard`, a property of the
*board* rather than of a session: `replaceSession` builds a fresh session on
every redeploy (not even `createdAt` survives it today), so the list is read
from the store, not carried by the session. Gone when the board is removed.

**Routes.** Owner, under the existing `/users/:username` guard — `POST` and
`DELETE`, so CORS (GET, POST, DELETE) needs no change. `POST` adds an entry or
replaces the name of the one with that email:

```
GET    /coordinator/users/:username/boards/:boardName/members
POST   /coordinator/users/:username/boards/:boardName/members          { email, name }
DELETE /coordinator/users/:username/boards/:boardName/members/:email
```

Anyone with a verified identity:

```
GET    /coordinator/shared      → boards whose list names the caller's email
```

**Two operations, not one verifier.** `auth.ts` is split:

- `identifyToken` — signature, issuer, audience, `sub`; the email **only if
  `email_verified`**, normalised. An unverified email is dropped, not refused,
  so nobody who can sign in today is locked out; the invariant becomes "an
  email in `AuthenticatedUser` is a verified one" (today it is copied through
  unchecked when no allowlist is set).
- `authorizeOwner` — `identifyToken`, then the server allowlist. What every
  existing route uses.

The allowlist-aware middleware runs **globally**, before the coordinator router
is reached, so a narrower check inside a route would never run. The member
paths — `GET /coordinator/shared` and the bridge upgrade — are named
explicitly as authenticating their own callers, the way `upgradeRoutes` already
names the join endpoint, and use `identifyToken`. This is the one change that
loosens something: the server allowlist goes from gating everything to gating
**who may own**, and a board's list gates who may attach to that board.

**Attaching.** A member connects the bridge naming the owner's id and the
board. Admitted: the owner (`sub` matches and passes `authorizeOwner`), or a
verified email on that board's list. Anything else closes the way an unknown
board does. Each bridge remembers its caller and role; `takeBridges` carries
both into a replacement session, which checks the list again.

**What a member's bridge may send.**

| Message | Member |
| --- | --- |
| `resync` | yes |
| `processService` | only at a service the facade names in a `process` action |
| `configureService`, `log`, `result`, `result-from-browser` | refused |

**The entry point is the capability, not the payload.** Naming a service in a
facade action makes that service member-callable with *any* payload — a custom
client is not bound to what the widget would send. So every field that matters
has to be checked behind the entry point. For the court board that means the
statements enforce identity, date, court and hour ranges and the booking limit
whatever `state` or the other fields claim; the present ones mostly do, and
get reviewed against this.

**A member's bridge never hosts a runtime.** It registers no `runtimeIds`, is
never sent `processRuntime`, and is never a target when the chain reaches a
browser runtime — `routeResult` chooses by role, where today it sends to every
open bridge. Otherwise the chain waits on an answer that would be dropped. A
board with a browser runtime still works for members; that runtime simply runs
only while its owner is attached, which is already what "a browser runtime
with nobody attached" means.

**A member is sent a projection, not the board.** A board's config carries
service state, and state can carry credentials (`cloud-boards.md` says so of
the files on disk). Hiding the playground does nothing if the bridge sends the
JSON. A member's snapshot contains:

- the facade;
- for each service the facade names: `uuid`, `serviceId`, `serviceName`, and of
  its state only the paths the facade's sources read;
- the board's status and errors.

Notifications are filtered the same way — only from services the facade reads —
and `log` entries are never sent.

**Who hears what.** A notification raised inside a run that has a caller goes
to **that caller's bridges only**; one from a run with no caller goes to
everyone (projected for members). This is what the context envelope in section
1 is also for: the notification carries the caller of its run.

**Removing a member** closes their bridges at once.

**Bounds.** A cap on members per board, on bridges per member, and a rate limit
on a member's `processService`.

**The audit trail.** A log entry gains the caller's `sub`, so the owner's run
log answers "who did this" without collecting addresses.

### 5. The frontend

- **Owner:** a members dialog on a deployed board (where Stop and Delete are):
  email and name per entry, add, edit, remove.
- **Member:** a "Shared with me" source wherever cloud boards are listed, fed
  by `GET /coordinator/shared`. Opening one renders the **facade from the
  projection** — there is no board underneath to show.
- **Invite link:** names coordinator, owner and board. A client **never sends a
  token to a coordinator the person does not already keep** — a link naming an
  unknown host asks first, otherwise a link is a way to collect tokens.
- **Facade:** `{ "$user": "email" | "name" }`, resolved beside `$state`. For
  showing who you are booking as; never what the server acts on.

### 6. The court-booking board

- The member is `CASE WHEN $caller_sub IS NULL THEN $member ELSE $caller_email
  END`: the typed address only when nobody is signed in at all. Not
  `coalesce($caller_email, $member)` — a signed-in caller without a verified
  email has a `NULL` email, and that must book nothing rather than fall back to
  what the payload claims.
- The label on a taken slot is the stored `$caller_name`, falling back to
  "Member".
- **A new table, not a migration.** `CREATE TABLE IF NOT EXISTS` adds no
  column to a table that exists, and `ALTER TABLE … ADD COLUMN` is not
  idempotent, while `sql` applies its schema once per process. This is a demo
  with a week of bookings at most: it moves to a new table and leaves the old
  one behind. That `sql` has no migration story is a gap of its own, noted and
  not solved here.
- **Who you are** shows "Booking as …" from `$user` and keeps the field for
  running without sign-in. The browser-only variant keeps working as it does.

---

## Phases

Each one leaves the system working and is worth having on its own.

1. **Caller in the run (hkp-node).** The `identifyToken` / `authorizeOwner`
   split; `ProcessContext.caller` on the three paths; `sql`'s binds, in node
   and the browser. Tests: a forged caller is ignored over **REST service
   process, REST runtime process and the runtime WebSocket**; a nested run
   inherits; a reserved bind beats an input field; auth off gives no caller.
2. **Process over the bridge, context across the chain.** The bridge message,
   the participant op, the `{ data, context }` envelope, the frontend routing.
   Owner only. A two-runtime integration test proves the same caller reaches
   both. Verify first that a facade `process` action on a deployed board fails
   today the way the code suggests.
3. **Members on the coordinator.** The list and its persistence across
   redeploy and restart; routes; member paths past the global middleware;
   attach by role; the send gate; no runtime hosting; the projection; private
   notifications; eviction; bounds; the caller in log entries.
4. **Members in the frontend.** The dialog, "Shared with me", rendering a
   facade from a projection, `$user`, the invite link.
5. **The board and the docs.** Court booking as above; `cloud-boards.md` and
   `coordinator.md`, `services/sql.md`, `board.md`, the board's page,
   CLAUDE.md's coordinator section; `/vocabulary` over the changeset. A
   two-person pass by hand: two accounts, one board, each sees their own
   "mine", neither can book as the other, a removed member is dropped.
6. **The other runtimes.** `processService`, the caller and the envelope in
   hkp-python's and hkp-rt's coordinator links and REST routes.

---

## Open questions

- **Telling everyone something changed.** With private notifications, B's
  calendar does not move when A books; it is right again on B's next tap. A
  live board needs a way for a run to say "everyone, look again" without
  sending anyone's view. Not needed to ship; needed for a chat-like board.
- **A service that speaks after its run ended.** The caller is read off the
  running context. A service that notifies or emits later, from a timer or a
  callback, has no run: its notification goes to everyone and its result
  carries no caller. `sql` does neither; anything asynchronous has to be
  checked before it is used on a shared board.
- **Shared state.** `sql` keeps `error` and `lastCount` in its state, so a
  facade reading them shows what the last caller left. Probably these should be
  news (notifications) only.
- **Members configuring.** A knob or text field that configures a service is a
  facade action a member cannot take in v1. Allowing it means bounding it to
  the keys the action names, or a member could rewrite a statement.
- **Naming the binds.** `$caller_email` reads well in a statement; the `__hkp`
  prefix is defined for state properties, and `$__hkpCallerEmail` is poor SQL.
- **A long-lived bridge outlives its token.** The socket is authenticated once,
  at upgrade — already true for owners. Removal evicts; expiry does not.
- **People without accounts.** An invite link that *is* the credential. A
  different model and not planned.

## Out of scope

Roles beyond owner and member, members of a board that is not deployed, a
migration mechanism for `sql`, and moving a board between owners.
