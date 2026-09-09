# Units and compositions

A board assembled from other boards. A **unit** is an ordinary board that still
runs alone, unchanged; a **composition** is an ordinary board that additionally
lists the units it is made of.

---

## The problem

Sub-services already compose *inside* a board: a pipeline nests in a service,
and the result is one document. That is the right unit of reuse for a step. It
is the wrong one for a half of an app.

Two halves of a business workflow — take enquiries in, find hotels that match —
are built by different people, run on different clocks, and each has to be
openable, runnable and testable on its own. Merging them into one document costs
exactly that: once merged, neither half is a thing you can open. Keeping them
apart and duplicating the shared parts costs the other thing: two boards that
drift.

Units are the third answer. **The document stays whole**, and a second document
says which whole documents make the app.

---

## What is added to a board

Two optional fields, on the same board descriptor everything else uses:

```json
{
  "boardName": "SYN Hotels",
  "unit": {
    "name": "hotels",
    "imports": ["booking.ready"],
    "exports": ["booking.quotes"],
    "params": { "requestsTopic": "booking.ready" }
  }
}
```

```json
{
  "boardName": "SYN",
  "units": [
    { "uri": "syn-booking-unit-board.json", "as": "booking" },
    {
      "uri": "syn-hotels-unit-board.json",
      "as": "hotels",
      "params": { "requestsTopic": "booking.ready" }
    }
  ],
  "runtimes": [],
  "services": {}
}
```

| Field | |
|---|---|
| `unit.name` | what this board calls itself as a unit |
| `unit.imports` / `unit.exports` | the topics it consumes and publishes — its interface |
| `unit.params` | defaults for `{{param.x}}`, which are what *running alone* means |
| `units[].uri` | **where** a document is, not what it is called |
| `units[].as` | the name this instance carries, and the prefix its runtimes get |
| `units[].params` | values for that instance's parameters |
| `units[].runtimes` | per-runtime overrides: `url`, `type`, or a pinned `id` |

Both fields live on every board descriptor, because they have to survive every
path a board arrives by — a file picker, a share link, a coordinator, an iOS
share sheet — and linking happens downstream of all of them.

---

## Linking is a projection along one axis

Assembling a composition produces one board, and the whole design rests on which
axis it renames.

A runtime is already a uuid namespace, one ordered pipeline, an independent
lifecycle and an addressable identity — everything a unit needs. So **a unit
contributes whole runtimes**, never services into shared ones, and the
projection qualifies exactly one thing: **the runtime id**.

```
hotels unit:        intake, review
booking unit:       intake, conversation, review
composition:        hotels.intake, hotels.review,
                    booking.intake, booking.conversation, booking.review
```

Service uuids are never touched, because they are already scoped by the runtime
holding them. Both units may call a service `after-intake`; in different
runtimes that has always been legal.

Qualification is a **prefix**, and therefore invertible — which is what lets a
save split back into the documents it came from. A unit entry may pin an id
instead (`runtimes: { intake: { id: "public-intake" } }`) for a mount outside
parties are configured with; pinning re-opens the collision the prefix closes,
so the projection then checks that every resulting id is still distinct. Distinct
runtime ids is the one invariant the whole scheme rests on.

### Two things that deliberately do not follow the qualified id

- **A unit's runtimes keep the unit's own board name.** hkp-node derives a mount
  address from (owner, boardName, runtimeId, mountName) and keys a database file
  on the board name. Letting the composition's name through would rotate a
  unit's public endpoints and silently move its unnamed databases to a different
  file. Prefixing changes the address the composition *routes* by; it must not
  change who the unit **is** to a server.
- **Units are never chained to each other.** Runtimes are chained — the result
  of one drives the next — so a unit occupies a contiguous block and the chain
  stops at its edge. A cross-unit chain would be a wire nobody wrote.

### So how do units talk?

**Over topics** — the `queue` service, publish on one side, consume on the
other. That is the same boundary two separate boards already have, and it is
what makes the two halves independent in *time*: a booking is read in seconds,
the hotels answer in days, and no pipeline spans days.

See **Queue** (`services/queue.md`) for the service itself.

---

## Parameters

`{{param.name}}`, anywhere in a unit's runtimes, services or facade. The unit's
own `params` are the defaults — running alone is running with those — and a
composition overrides them per instance.

A reference with no value is **left as it stands**, not blanked. Unlike a secret,
where an empty string is what every service already reads as "not configured", a
parameter is usually a topic, a database or a URL, and emptying one produces a
service that does something wrong quietly instead of failing. Left intact it is
visible in the board and named in a diagnostic.

Parameters are also what keeps a cross-unit topic *checkable*: `{{param.topic}}`
is substituted before the checks run, so the value it resolves to is visible to
them. A topic built inside an expression is not, and no static pass will see it.

---

## Where a unit comes from: no registry

There is deliberately **no unit registry**. A registry is a second place that
has to know about every unit that exists, and boards do not arrive from anywhere
a registry could watch.

So a reference **names**, and *the origin the composition itself was loaded
from* **retrieves**. The same `hotels` means a sibling file on disk, a document
beside the share link, or a saved board, depending on where the composition came
from — which is what makes a relative reference the sensible default and an
absolute URL the deliberate exception.

| Origin | A relative `uri` means | Where |
|---|---|---|
| `urlUnitOrigin` | a sibling URL: `/boards/hotels.json` beside `/boards/syn.json` | a board opened by URL |
| `nativeFileUnitOrigin` | a sibling file on disk | a board opened through a native picker, which returns a *path* |
| `filesUnitOrigin` | one of the files handed over in the same gesture | several files dropped or picked at once |
| `defaultUnitOrigin` | a saved board of that base name | always chained in as a fallback |

A browser gives a page no access to the siblings of a single picked file, which
is why dropping a composition on its own cannot resolve anything and dropping it
*with* its units can. `chainUnitOrigins` tries several in turn, so a board can be
reachable more than one way; saved boards are always in the chain, since a unit
may be one however the composition arrived.

Resolution is **transitive** — a unit may itself be a composition — because each
document resolves its own references against its own origin, exactly the way
modules do. Names compose through nesting (`outer.inner`), so a nested unit's
runtimes stay addressable and the distinct-id invariant still covers them.
Cycles are detected and reported rather than followed.

---

## Diagnostics, and who is responsible

Linking runs on **every** board, not only compositions: a unit opened alone is a
projection of one, and gets the same checks over what it declares. Errors are
raised — a composition with a hole in it would otherwise start, run, and go
wrong later somewhere that cannot explain why — and warnings are toasted.

The rule on unsatisfied imports is **responsibility follows inclusion**:

| Situation | Level | Why |
|---|---|---|
| The board being opened imports a topic nothing here exports | warning | Nobody promised to satisfy it. This is what running alone looks like. |
| A unit the composition *included* imports one nothing exports | **error** | By listing that unit, the composition asserted this set is the app. |

Nothing has to ask whether a document "is a composition": each level answers for
what it includes, and the top level answers to nobody.

The rest are warnings about a unit's declared interface against what its
services actually do — an export never published, an import never consumed, a
topic used without being declared — plus one about an export nobody takes,
because that is legal *and* fills a queue forever.

A composition whose units could not be found gets a remedy rather than a dead
end: the board view offers to go and get them, and the files the reader picks
become the origin it links against — so the same reference resolves without the
composition being edited.

---

## Views: units are not merged into one surface

Each unit contributes its **own facade** as a view, and the board is looked at
through one of them at a time — tabs beside the facade, not one merged panel
set. A view carries the runtime ids it may address, and the board context is
narrowed to them (`narrowBoardContext`), so a unit's facade addresses its own
services and nothing else. A board that is not a composition has the single
facade it always had.

---

## Saving: the inverse of linking

`serializeBoard` produces the link **output** — one flat board, which is what
deploying, sharing and exporting want, the way a bundle is. Saving wants the
opposite: **the sources**. Saving the projection would flatten the composition
permanently.

What makes the split more than a regrouping is that loading *changed* the
documents on the way in — parameters were substituted, a composition may have
overridden a url or pinned an id — and writing the running board back verbatim
would bake all of that into the unit, destroying the thing that made it
reusable.

So `unlinkProjection` is a **three-way merge**, not a copy:

1. Each runtime says which unit it came from (`unit`, `unitRuntimeId`), written
   by the projection. No provenance means the composition declared it —
   including a runtime somebody just added in the playground, which lands there
   by default.
2. The projection is **recomputed** from the source document — what loading this
   unit *should* have produced.
3. Any value the running board still holds unchanged is written back as the
   source spelled it: `{{param.topic}}`, not the topic it resolved to. Only
   values that actually differ — the ones somebody edited — are taken from the
   running board.

Two details that fall out of it: arrays are merged element-wise only while the
shape holds, since an insertion renumbers everything after it; and a write-only
secret answering `getState` with an empty string means *not reported*, never
*cleared*, so where the document named a secret the name stands.

Each unit is then written back to the saved board it came from, addressed by the
base name of its `uri`, so a save lands where the next load will look. A unit
read from a URL has no writable place to go back to and is skipped.

---

## Known gaps

- **A unit must be reachable under its base name** when the origin is saved
  boards — those are keyed by board name, not file name. A board stored under a
  title resembling neither is not reachable that way; an explicit name would
  close that gap.
- **Units on one runtime server share its queue.** Messages live with the
  runtime that took them in, so two units that must talk are deployed against
  the same server. Reaching a queue on another server is a job for the
  coordinator, and is not built.
- **Views do not compose.** A composition can show its units' facades and its
  own; it cannot draw one surface out of parts of several.
- **No versioning.** A `uri` addresses a document, and whatever is there is what
  links.

---

## Where it lives in the code

| Concern | Where |
|---|---|
| Vocabulary, projection, unlink | `hkp-frontend/src/runtime/board/units.ts` |
| Resolving a `uri`, origins, diagnostics | `hkp-frontend/src/core/linkUnits.ts` |
| Linking on load, splitting on save | `hkp-frontend/src/core/boardPersistence.ts` |
| Linkage held while a board is open | `hkp-frontend/src/BoardContext.tsx` |
| Views and narrowing | `hkp-frontend/src/views/playground/BoardEntryPoint.tsx`, `facade/boardServices.ts` |
| Origin for how a board arrived | `hkp-frontend/src/views/playground/PlaygroundController.ts` |
| Missing-unit remedy | `hkp-frontend/src/views/playground/BoardFetchError.tsx` |
| Boards served so relative URLs resolve in dev | `hkp-frontend/vite-plugins/serveBoards.ts` |
| Worked example | `hkp-frontend/boards/syn-board.json` + `syn-booking-unit-board.json`, `syn-hotels-unit-board.json` |
| Tests | `hkp-frontend/src/runtime/board/tests/units.test.ts`, `core/tests/linkUnits.test.ts`, `linkUnits.syn.test.ts` |

---

See also: **Board** (`concepts/board.md`) for the document being composed,
**Runtime** (`concepts/runtime.md`) for why the runtime is the axis, **Mounts**
(`concepts/mounts.md`) for the references the projection rewrites, and **Queue**
(`services/queue.md`) for how units actually talk.
