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
    { "id": "node", "name": "Node", "type": "rest", "url": "http://127.0.0.1:8080", "state": {} }
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
  `chat-node` without two people colliding on one server.
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
| Host-specific URLs | substituted from `HKP_RUNTIME_HOST`, `HKP_RUNTIME_URL`, `HKP_WEBAPP_URL` at load | the same board opens on a laptop and a phone (`hkp-frontend/src/templateVars.ts`) |
| Live service output | nowhere — it is a notification, not state | a Monitor's messages are its output; `getState()` reports configuration |

The rule behind all four: **a board records intent, not the circumstances of one
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

---

## Who owns a board

Exactly one instance, always — and which one changes what the browser may do:

| Board runs as | Owner | Browser's role |
|---|---|---|
| Playground / Readymade | this browser | owns it: provisions runtimes, holds engine state |
| Deployed | a coordinator | viewer: reads, configures, cannot edit structure |

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
| Example boards | `hkp-frontend/boards/*.json` |

---

See also: **Runtime** (`concepts/runtime.md`), **Service**
(`concepts/service.md`), **Mounts** (`concepts/mounts.md`), **Coordinator**
(`concepts/coordinator.md`), **Cloud boards** (`concepts/cloud-boards.md`),
**Units and compositions** (`concepts/units.md`), **Logging**
(`concepts/logging.md`).
