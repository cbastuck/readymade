# Board

The top-level unit: a named, self-contained description of an app — its runtimes, the services inside them, and optionally the facade that presents it.

---

## What a board is

Everything lives on a board. It is the unit a person thinks in ("my doorbell
board", "the booking board"), the unit that gets saved, shared, forked and
deployed, and the unit a coordinator owns.

Structurally it is one JSON document, `BoardDescriptor` in
`hkp-frontend/src/types.ts`:

```ts
type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  registry?: ServiceRegistryMap;
  boardName?: string;
  description?: string;
  facade?: FacadeDescriptor;
};
```

That is the whole model. There is no wire list, no graph, no separate flow
definition: **order is the wiring**. Runtimes run in array order, and the
services inside each runtime run in the order they are listed.

```json
{
  "boardName": "My Board",
  "runtimes": [
    { "id": "ui",   "name": "Browser", "type": "browser", "state": {} },
    { "id": "node", "name": "Node", "type": "rest", "remote": "node", "state": {} }
  ],
  "services": {
    "ui":   [ { "uuid": "tick", "serviceId": "hookup.to/service/timer", "serviceName": "Timer", "state": {} } ],
    "node": [ { "uuid": "log",  "serviceId": "monitor", "serviceName": "Monitor" } ]
  }
}
```

---

## Ids, and why they matter

`runtimes[].id` and each service's `uuid` are not decoration. They are how
everything in and around a board refers to a part of it: which runtime a
service list belongs to, which service a facade widget drives, which service a
mount reference names.

- **A board loaded from JSON keeps the ids the file carries.** That is what
  makes them stable across reloads — a runtime server can recognise the runtime
  it already has and attach rather than rebuild.
- **Ids are unique per user, not globally.** hkp-node namespaces runtimes by the
  authenticated `sub`, so boards can ship readable ids like `node` or
  `chat-node` without two people colliding on one server. A deployed board's
  runtimes are further kept per board, so two of one person's boards may share
  an id too (`concepts/cloud-boards.md`).
- **Copying a board must rename all of them.** Otherwise the copy provisions
  over the original's runtimes — an editor whose changes land somewhere else.
  `hkp-frontend/src/core/forkBoard.ts` does the renaming, driven by *field name*
  rather than by value, because an id like `node` is an ordinary string that can
  appear anywhere in a document. `KNOWN_REFERENCE_FIELDS` is where a new
  id-carrying field gets registered.

---

## Order is the default, not the only shape

Everything above describes a line: runtimes in array order, services in list
order, each result becoming the next input. That is the shape a board should
have, and almost every board can have it.

It is not a cage, though. A board can also **jump**: a service can name another
service by id and reconfigure it, or hand it data to process; a service can call
a whole runtime by name. Those are real capabilities with real uses — a feedback
loop, a state machine, a control panel that reconfigures something elsewhere —
and `concepts/runtime.md` lists the mechanisms.

**Treat them the way you treat `goto`.** They are not forbidden, they are
expensive:

- A jump makes two parts of the board know about each other. Neither can be
  moved, renamed or reused without the other, and reading either one no longer
  tells you what happens.
- A named id is a reference generic machinery has to know about. Every one of
  them is a field in `KNOWN_REFERENCE_FIELDS` (`core/forkBoard.ts`) —
  `targetServiceUuid`, `targetRuntime`, `serviceUuid` — because a fork has to
  rewrite them or the copy reaches into the original. A service that invents its
  own way to name another one is simply not carried across.
- The flow stops being visible. The list no longer says what runs, and nothing
  else does either.

**The alternative is nesting, and it is almost always available.** A pipeline
inside a service is a step of the outer pipeline: the host knows its nested
pipeline, and the nested pipeline knows nothing about its host. That ignorance is
the point — it is what makes the group movable, reusable and readable on its own.

The clearest example is the `join` service (hkp-node): it runs a nested pipeline
as a **detour** and merges the result *beside* the input rather than replacing it.
Two services that would otherwise have to know each other's ids — one producing
a value, one filing it against the record it belongs to — become one grouped step
that takes a value in and hands a bigger value out. Same for `sub-service` (a
pipeline as a step), `switch` (pipelines as branches), `looper` (a pipeline
repeated) and `board-service` (a whole saved board as a step).

The question to ask when reaching for a jump is: *what value am I actually trying
to get from over there?* Usually there is a grouping that produces that value
where it is needed, and then nothing has to reach anywhere.

---

## What a board deliberately does not contain

| Not in the board | Where it lives instead | Why |
|---|---|---|
| Secret values | the host's secret store, referenced as `{{secret.alias}}` | a board is meant to be shared, downloaded, handed to a model — there is nothing to redact because it never held the value (`core/secrets.ts`) |
| Mount addresses | published by the owning service at load, referenced as `hkp-mount://…` | the address is assigned when the board loads, so no file can know it (see `concepts/mounts.md`) |
| Where a runtime server listens | the remotes each client keeps, referenced by name as `"remote": "node"` | an address is only true from where it is dialled; the name opens on each person's own server (see `concepts/remotes.md`) |
| Host-specific URLs | substituted from `HKP_RUNTIME_HOST`, `HKP_RUNTIME_URL`, `HKP_WEBAPP_URL` at load | the same board opens on a laptop and a phone (`hkp-frontend/src/templateVars.ts`) |
| Live service output | nowhere — it is a notification, not state | a Monitor's messages are its output; `getState()` reports configuration |

The rule behind all five: **a board records intent, not the circumstances of one
run.** Anything only true of one machine on one day is resolved on load, not
written down.

---

## Loading a board

A board is **linked** first: if it lists `units`, those documents are resolved
and projected into it, and what runs is the projection. A board that lists none
is its own projection, so nothing else here has a special case for it. See
**Units and compositions** (`concepts/units.md`).

Then `restoreBoard()` in `hkp-frontend/src/core/boardPersistence.ts`:

1. If any runtime needs authentication, wait for the user session to settle —
   remote runtimes authenticate every call with the user's id token, and
   provisioning without one gets a 401.
2. Restore **every runtime concurrently** (`Promise.all`), each through the
   `RuntimeApi` for its type.
3. Services are restored with their secret references intact. Nothing is
   substituted into service state: a resolved value in state is a value that
   comes back out of `getState()` and into the next saved board.

That concurrency is worth remembering, because it is the reason so much in HKP
is *lazy*: when one runtime comes up, the runtimes it points at may not exist
yet. "Not resolved yet" is a normal state, not an error.

## Saving a board

`serializeBoard()` in the same file asks **each service for its live state**
(`getServiceConfig`) rather than writing down what the board was loaded with.
A service reports what it was configured with, so a board round-trips — and this
is also why anything the machinery pushes into a service's state ends up in the
saved file.

A board assembled from units is written back as the documents it was assembled
from, never as the one board it is running as; `serializeBoard` is the flat
output that deploying, sharing and exporting want.

---

## What you can do with a board

| Action | What happens | Where |
|---|---|---|
| **Save / load** | one JSON document per board, kept by the host — files on desktop, `localStorage` on the web | `backend.saveBoard` / `loadBoard` (`meander/frontend/src/backend/types.ts`) |
| **Import / edit source** | paste a board JSON in *Edit Board Source*; hosts that support it keep the unparsed text too | `loadBoardSource` / `saveBoardSource` |
| **Share as a link** | the board is compressed into a URL that opens it in the playground | `views/playground/BoardLink.tsx` |
| **Share as a QR / partner board** | a *subset* of the board travels — the runtimes the receiver can reach — with mount references and template variables baked into concrete values first | `ui-components/runtime-ui/RuntimeHeader.tsx`, `facade/FacadeRenderer.tsx` |
| **Fork** | a copy with every id regenerated, so it is a board of its own | `core/forkBoard.ts` |
| **Deploy** | hand it to a coordinator that provisions its runtimes and keeps them running | `core/deploy.ts`, see `concepts/cloud-boards.md` |
| **History** | hosts may snapshot the board on every structural change | `onBoardInfrastructureChange` → `pushBoardSnapshot` |

Note what the export cases have in common: **references are resolved on the way
out.** A reference is meaningful only inside the board that also holds the thing
it names, so a board leaving for another device gets concrete values instead.

---

## The facade

A board can carry a `facade`: a JSON description of a polished, app-like surface
of controls and displays laid over the services. Developers build the internals;
the facade makes the result usable by someone who neither knows nor cares what a
service is.

Widgets reference services by `serviceUuid` — another id-carrying field, which
is why forking rewrites it. Types live in `hkp-frontend/src/facade/types.ts`;
the full widget catalogue is in `CLAUDE.md` and the `/new-board` skill.

Beside its panels a facade declares two things about what is on screen and when.
**Tabs** group the panels into faces shown one at a time, because a board's
controls rarely all belong to the same person or the same moment — a feed is
subscribed to once and read every day. They are a view over the panels the
facade already has: a tab names panel ids, a panel no tab names stays on screen
above the bar, and `defaultTab` — which is not remembered between visits — is
what everybody gets. A panel can also be another's **detail** (`detailOf`) — a
story's discussion beside the list of stories. Where they fit side by side they
are; on a phone the detail opens in place of its master, from a `show-panel`
action, with a way back to the list as it was left. **Notices** are what a board says without being looked at: a
toast raised from what a service reports, instead of a row kept free for a
problem that is usually not there.

A facade can say **who it is being shown to**: `{ "$user": "name" }` or
`{ "$user": "email" }`, usable wherever a `{ "$state": … }` reference is — in a
payload, or as a `text` widget's `value`. On a deployed board `name` is what
that board's member list calls the person; elsewhere it is the account's own.
It is for *showing* somebody who they are acting as. A service that has to
know who is calling asks the run, which the server states — see
[SQL: who is calling](../services/sql.md#who-is-calling). Nothing a facade puts
in a payload proves it.

And it can keep a part of itself **for the board's owner**: a widget, a
container, a panel, a tab or a notice carrying `"visibleTo": "owner"`. On a
deployed, shared board the coordinator leaves it out of the facade a member is
sent, so a member is not shown it, cannot act through it, and is not sent what
it reads; anywhere else whoever has the board open is its owner and sees it
all ([Cloud boards](./cloud-boards.md#sharing-a-board-members)).

### The facade editor

Open the facade editor from the toolbar to build or change a facade. Its tree
has three items at the top:

- **Panels**: each panel and its layout. Select a panel or a widget to change
  its properties. Selecting Panels itself shows the facade's own settings
  (`layout`, `tabs`, `defaultTab`).
- **State**: every facade state key, with its value now, the widgets that write
  and read it, and its recent writes.
- **Actions and Updates**: what the facade does by itself. That's the
  **Actions** it runs when it opens (`init`) and the **Updates** it raises as
  notices.

Whatever you change goes straight into the board's facade and is saved with
the board. The one exception is a composition: there each unit brings its own
facade, and changes to it show up but aren't saved yet. The editor tells you
when that's the case.

When the facade and the board are both on screen ("Facade above the board"),
every widget that's connected to something gets a small link badge in its
corner. Click it and the editor opens on that widget. The tree and the facade
follow each other, so selecting a widget in the tree highlights it on the
facade too. A deployed board has no editor and no badges: to change one,
change it in the playground and deploy it again.

### What a widget is connected to

What connects a widget to the board is its **facade bindings**, and they go
two ways. A selected widget shows each way in its own tab beside its
properties:

- **Acts on** lists what the widget sends: a `configure` (and which keys), a
  `process`, a file it hands over, frames it captures. It also lists the
  facade state the widget writes (`set-state`, a table's or swimlane's
  selection) and the state its actions use (`{ "$state": … }` in a payload).
- **Updated by** lists what the widget shows: a service's report (its
  `source`, at a `path`), and facade state it shows in its `value`, `items` or
  `summary`.

Each service in the list comes with where it lives, like `Node › Switch ›
case "paid" › Mailer`, so two services with the same name are easy to tell
apart. **Show in board** opens every nested pipeline on the way and highlights
the service. **Inspect** does the same and opens its
[Flow Inspector](./runtime.md#what-crosses-a-runtime-boundary), on the input for
something the widget acts on and on the output for something that updates it.
A service that can't be reached says why: it's missing, it's inside a block
use (shown as the use as a whole), or its runtime isn't attached.

Every `configure` and `process` also shows **what the widget actually sent**:
the last payload and, below it, the recent ones. That's the payload after
`$state`, `$user`, `$$input` and `{{value}}` were filled in, so it's exactly
what the service got. Your browser keeps the last ten per widget for as long as
the board is open. It works on any runtime and without Capture mode, because
the facade records what it sends itself and nothing extra leaves the browser.
Actions the facade runs when it opens are listed the same way, under Actions
and Updates.

Nothing in the board document describes these connections. They're read from
the widgets themselves, so any facade has them:

| Field on a widget | Listed under |
| --- | --- |
| `action`, and each `configure` or `process` in `actions` | Acts on |
| `set-state` in `actions`; `selectable` on a data table or swimlane | Acts on (writes facade state) |
| `{ "$state": "key" }` inside an action's payload | Acts on (uses facade state) |
| `source`, `progressServiceUuid`, `thresholdKnobServiceUuid` | Updated by |
| `{ "$state": "key" }` in `value`, `items` or `summary` | Updated by |
| `serviceUuid` of a `camera` | Acts on (captures into it) |
| `serviceUuid` of a `canvas` or `detect` | Updated by (shows its surface) |
| `serviceUuid` of an `xy-pad` | both: shows its surface, configures `position` and `eventType` |

A uuid inside a payload is a value being sent, not a connection. A repeat's
template is read once per item, after the item is filled in. The rules live in
`hkp-frontend/src/facade/bindings.ts`.

---

## Who owns a board

Exactly one instance, always — and which one changes what the browser may do:

| Board runs as | Owner | Browser's role |
|---|---|---|
| Playground / Readymade | this browser | owns it: provisions runtimes, holds engine state |
| Deployed | a coordinator | viewer: reads, configures, cannot edit structure |
| Deployed, shared with you | a coordinator, for its owner | member: sees the facade and what it reads, does what the facade does, and is shown nothing else of the board |

The role that owns the board is the **coordinator**
(`concepts/coordinator.md`), and moving between the two rows is
**deploying** (`concepts/cloud-boards.md`).

---

## Rough index into the source

| Concern | Where |
|---|---|
| The type | `hkp-frontend/src/types.ts` (`BoardDescriptor`, `isBoardDescriptor`) |
| The live board (engine state, actions) | `hkp-frontend/src/BoardContext.tsx` |
| Load / save | `hkp-frontend/src/core/boardPersistence.ts` (`restoreBoard`, `serializeBoard`) |
| Copying a board | `hkp-frontend/src/core/forkBoard.ts` |
| Deploying | `hkp-frontend/src/core/deploy.ts` |
| Secret references | `hkp-frontend/src/core/secrets.ts` |
| Host template variables | `hkp-frontend/src/templateVars.ts` |
| Facade | `hkp-frontend/src/facade/` |
| Host storage | `meander/frontend/src/backend/types.ts` (`BackendAdapter`) |
| Example boards | `boards/*.json` |

---

See also: **Runtime** (`concepts/runtime.md`), **Service**
(`concepts/service.md`), **Mounts** (`concepts/mounts.md`), **Coordinator**
(`concepts/coordinator.md`), **Cloud boards** (`concepts/cloud-boards.md`),
**Units and compositions** (`concepts/units.md`), **Logging**
(`concepts/logging.md`).
