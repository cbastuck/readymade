# Blocks

A configured service — usually a sub-service and its pipeline — defined once in
a board and used wherever a pipeline names it. The step between a service and a
unit: a unit is half an app and contributes whole runtimes; a block is a piece
of a pipeline and sits inside one.

```json
"blocks": [
  { "id": "note", "name": "Note", "serviceId": "sub-service",
    "params": { "trigger": "hihat", "volume": 0.5, "beats": 0.5 },
    "state": { "scope": { "slots": "inherit" }, "pipeline": [
      { "block": "hit", "instanceId": "hit",
        "params": { "trigger": "{{param.trigger}}", "volume": "{{param.volume}}" } },
      { "serviceId": "hookup.to/service/timer", "instanceId": "wait",
        "state": { "oneShotDelay": "{{param.beats}}", "oneShotDelayUnit": "beats" } } ] } }
]

{ "block": "note", "instanceId": "kick", "params": { "trigger": "kick", "volume": 0.9 } }
```

**State:** designed 2026-09-26; phases 1–5 built on `nesting_audio`, with what
is left under *Still to build* and *Open*.

---

## Decided

| Question | Decision | Why |
|---|---|---|
| Name | **Block**; a place that names one is a **use** | "Reference" already means two things (mount, secret); "apply" is the preset verb and means copying. The nested-rhythm facade already says "blocks". In the vocabulary. |
| Editing model | **A use is frozen while the board runs**, plus an explicit **Detach** | Saving writes each use back as authored — no comparison of what is running against what the use produced. See *The model*. |
| Parameters at runtime | **Yes, from the use's panel** | The one sanctioned way to vary a use without detaching it. |
| Addressing inside a use | **Refused** | A use's inside belongs to its definition. What varies per use is its params. |
| Where definitions live | **Board-local `blocks`**, files later | Files raise consolidation with presets, which is deliberately not decided now. Every choice below that touches this leans towards it. |
| Sharing, board source | **Keep blocks** | Share links and "Show board source" carry the documents, not the flat projection. A shared board is exactly the one that has to stay reusable. |
| Editing a definition | **As a level**, applied to every use | See *Editing a definition*. |
| Creating a block | **From a configured sub-service** | "Make block": it becomes the definition, and its place becomes the first use. |
| Units | **Each document's own blocks** | A unit's definitions expand in its own runtimes and save back into the unit. A composition's blocks are invisible to its units. |

---

## The model

### Linking — expand

Every use is replaced by what it stands for: the definition's service, with the
use's params substituted into its state. That expansion then recurses into
the uses nested inside it. What is provisioned is an ordinary board. **No
runtime knows blocks exist.**

- **Params are lexical.** `{{param.x}}` inside a definition is that block's
  parameter. Anywhere else in a unit's services it is the unit's parameter. Unit
  substitution already walks only `runtimes`, `services` and `facade`, never
  `blocks` (`units.ts#projectUnits`). Keep it that way and test it.
- A whole-string reference takes the value's **type**. One inside a longer string
  is written in as text. A reference with no value is left as it stands and
  warned about, as unit params are.
- A definition's params may name a block (`{ "block": "{{param.beat}}" }`).
  Substitution happens before the nested expansion.
- Each use is **placed**: its path from the service map (ids where entries
  have them), its id, the use as written, and its parent placement.
  This tracking is the one piece of state linking keeps. Any model that expands
  on load and writes uses on save needs it.

### Running — frozen

- **The inside of an attached use is locked**: `inert`, like the background
  levels in `NestedNavigation`, and badged as a use of its block. Structural
  edits (add, remove, reorder) are unavailable in it. This is not optional. An
  unlocked inside invites edits that saving then discards, which is the worst
  outcome available.
- **Nothing addresses the inside of a use.** Enforced where the board calls:
  - `findService` and `processService` refuse an address that passes through a
    use.
  - Linking warns about any facade widget, and any Configurator target, that
    points inside one.

  A remote runtime's REST API can still reach it. This is a board rule, not a
  security boundary.
- **Params from the use's panel.** A change re-instantiates that use with its
  new params and configures it with the result, by its address. The live use in
  linkage is updated, because linkage is what saving writes.
  - For a sub-service block this reconfigures only the use's own pipeline.
    Siblings keep running.
  - For a single-service block the instantiated state names exactly the keys the
    definition does. A plain configure is therefore a replace, and no
    recreate is needed.
- **Detach** turns one use into an ordinary copy: its placement is dropped, its
  inside unlocks, and from then on it saves as whatever is running. Uses nested
  inside it stay attached, and so stay locked.

### Saving — write back

Every **outermost attached** use is written back as linkage holds it: the use
as authored, with the params last set from its panel. Nothing is compared.
Everything outside a use is serialised as it always was. The board's `blocks`
go with it.

### What this buys, and what it costs

- ✅ Saving is unconditional. The comparison, the break-off rules and their
  unfixable gaps (fields a definition leaves unnamed, a use moved elsewhere)
  are gone.
- ✅ What is saved is always what was authored plus what was deliberately
  changed: params, a detach, a definition edit.
- ⚠ **Runtime state inside a use is live only.** Anything a service inside a use
  learns or reports at runtime — a Hold's value, a counter — is not saved. It
  behaves like a Timer's `running` flag.
- ⚠ **Locking is coarse.** `inert` also blocks harmless interaction inside a use
  (Trigger Oneshot, scrolling a Monitor). Trying something inside a use means
  editing the definition, or detaching.
- ⚠ **Varying one use beyond its params is a Detach**, and a detached copy no
  longer follows its definition.

---

## Editing a definition

**In place, on a use.** "Edit block" on a use unlocks that one use as the
working copy, in its real context: the scope it sits in, the tempo slot, the
board actually driving it. Services are edited, added and removed as anywhere
else. **Apply**:

1. Reads the working copy's configuration.
2. Puts the parameter references back. At each path where the definition held
   `{{param.x}}`, the reference is kept. A value changed there becomes that use's
   param, not the definition's: **param-driven fields belong to the use,
   everything else to the block.** A path that no longer resolves after a
   structural edit loses that parameter site, with a warning.
3. Replaces the definition.
4. Re-instantiates every attached use of it, each configured by its address.
   Timers in them restart. That is an edit's cost.

**Cancel** re-instantiates the working copy from the unchanged definition.

A separate sandbox level was considered and rejected: see *Resolved*.

---

## Towards presets

The two are too alike to stay separate. A preset is a service's configuration,
applied as a copy; a block is a service's configuration, used by reference. The
likely end is **one document with two verbs**: *apply* (copy, today's preset)
and *use* (reference, a block). So, wherever there is a choice:

- **A definition is a preset.** `BlockDefinition` is `Preset` plus `params`, parsed
  by `parsePreset` extended to keep them. Same fields: `id`, `name`,
  `serviceId`, `serviceName`, `description`, `tags`, `version`, `secrets`, `state`.
- **Canonical service ids**, matched the way presets are (legacy
  `hookup.to/service/*` aliases).
- **"Make block" is `presetFromService` plus a first use.** That includes
  dropping `__hkp*` fields, so a definition carries no board-bound addresses.
- **`params` is designed for both verbs.** Applying a preset with params
  would be the same substitution followed by an immediate detach.
- The one real difference, kept visible: a preset is keyed by
  (`serviceId`, `id`), while a use names a block by `id` alone, unique within the
  board. Files will need a `from` beside `block`, resolved by the unit origins.

---

## Work

### 1 — Core

- ☑ `BlockDefinition` is `Preset` without the marker, read by `parseBlockDefinition`
  (`core/presets.ts`); presets gained `params`, substituted on apply
  (`presetState`) — both application paths, `applyPreset` and palette creation
- ☑ Unconditional write-back of the outermost attached uses (`collapseBlocks`);
  placements carry `parent`, `address` and `document`
- ☑ Collision-free ids for uses written without one (`freshId`), never written back
- ☑ A use's address; `blockUseAt` / `blockUseContaining`
- ☑ Diagnostics: unknown, cycle, duplicate, invalid definition, param with no
  value, param undeclared — by a use or referred to by a definition. Reported by
  `reportLinkDiagnostics` (renamed from `reportUnitDiagnostics`), "Board linking:"
- ☑ Units: each document's own blocks (`core/linkBlocks.ts`), unit uses resolved
  against the unit's, written back into the unit; unit params never touch
  `blocks` (tested)
- ☑ Tests: `runtime/board/tests/blocks.test.ts`, `core/tests/linkBlocks.test.ts`,
  `core/tests/block-use.integration.test.ts`, preset params in `presets.test.ts`

### 2 — Every path a board arrives or leaves by

- ☑ Audit: the playground controller was the one place picking fields (fixed in
  the prototype); `forkBoard` (templates) now carries `blocks`; Meander, mobile,
  drafts, file drop and share links pass the whole descriptor; native backends
  store boards as opaque JSON; `partnerBoard` derives a board to hand on and is
  flat by design
- ☑ Share link and board source keep the board's own blocks
  (`serializeSharedBoard` → `unlinkBlocks(…, { ownOnly: true })`). A unit's uses
  stay expanded there: a link carries no unit for them to name. Not
  `serializeBoardDocuments` as planned — that would have made a composition's
  share link depend on its units being findable
- ☑ Deploying stays flat — documented in `concepts/blocks.md`
- ☐ The planned copy & paste carries the definitions the copied uses need
  (its plan, `TODO-COPY-PASTE`, is not on this branch — add it there)
- ☑ The demo-board regression links blocks, fails on link errors, and checks
  every nested `serviceId` against the registry (it checked top-level ones only)
- ☑ e2e `e2e/tests/blocks.spec.ts` (web): lock, params into the running service
  and the save, detach, edit/apply with a param-driven and a plain field, make
  block + palette drop

### 3 — Running board UI

- ☑ Lock and badge (`runtime/ui/BlockUse.tsx`): desktop pipelines and levels,
  top-level services, the mobile service sheet (panel inert, config editor and
  sub-pipeline edits off)
- ☑ The use's bar: params with editors from the defaults' types (16px on mobile),
  Open, Edit block, Detach, Remove
- ☑ Refusal in `findService` / `processService` — reads refused as well, since
  notifications go through `findService`; link-time warnings for facade widgets
  and Configurator targets (a Configurator inside the same use is left alone)

### 4 — Authoring

- ☑ Make block, in a sub-service's menu (`makeBlock`); uses already inside it stay uses
- ☑ The board's blocks in the Building Blocks sidebar; a drop adds a use through
  `addService` (a palette card with `block` beside `preset` — the two verbs on
  one card type)
- ☑ Edit definition in place: Edit block → working copy (`linkage.blocks.editing`)
  → Apply / Cancel, on the use's bar and on a level opened on it

### 5 — Docs

- ☑ `concepts/blocks.md`, `board-json.md`, `concepts/presets.md` (params, the
  other verb), the nested-rhythm page and board description, `testing.md`,
  `CLAUDE.md`, the vocabulary entry

### Still to build

- ☐ Offer blocks in a sub-pipeline's own service selector, so a use can be added
  inside a pipeline and not only to a runtime
- ☐ Applying an edit closes a level open on the working copy (its pipeline is
  rebuilt); keep the level open
- ☐ A use moved to another pipeline is written back expanded — found by id only
  within the pipeline it was placed in
- ☐ Mobile drills only into remote runtimes' sub-services (the `subservices`
  capability), so nested browser uses are reachable there only through the
  service UI — pre-existing, not a blocks gap, but it shows here
- ☐ Remote runtimes: re-instantiating a use by address rebuilds only that use —
  verified for the browser runtime; hkp-node, hkp-python and hkp-rt untested

## Open

- **Param declarations.** `name: default` is what the bar infers its editors
  from (number, text, checkbox). Labels and ranges — a knob for a volume, 0–1 —
  need more: an object form (`{ default, label, min, max }`), which parametrised
  presets would want too.
- **Re-instantiating a use by address on every runtime.** Browser SubService and
  Switch resolve nested addresses (`findNested`), and hkp-node's SubService does
  too. Verify that `configure({ pipeline })` rebuilds only that use in each
  runtime's SubService (hkp-node, hkp-python, hkp-rt). Also verify that
  Switch and Tracks case entries are reachable when their case has not run yet.
- **Param-driven fields during a definition edit** belong to the use — built and
  covered by the e2e spec. If it reads wrong in practice, the alternative is that
  they edit the param's default.
- **The consolidation itself**: the unified document's name, `from` for files,
  and whether presets gain the *use* verb or blocks the *apply* verb first.
- **`{{param.x}}` and `scope.params`** (`TODO-SCOPES`, *Open*). Blocks are one
  answer to "the same pipeline twice in one runtime". If scopes grow params, they
  should be this mechanism, not a second one.

---

## Resolved, so it is not re-opened

**Automatic break-off on change** — the prototype. Any edit inside a use made it
save expanded. It needed a comparison of what runs against what the use
produced, with rules for renaming and bypassing. It stayed wrong at the edges: a
field the definition does not name could change without breaking off, and a
use moved to another pipeline broke off although nothing in it had changed. It
grows with every exception.

**Saving flat.** The first save destroys every block, and it happens at
exactly the point where a board is about to be shared and evolved.

**A marker the runtimes carry** instead of recorded paths. Every container
service in every runtime would have to preserve an opaque field on its
pipeline entries. The browser SubService already picks entry fields
explicitly. Paths keep the runtimes out of it.

**Editing a definition in a sandbox level.** A second, unconnected
instantiation: it has no surrounding scope, so a Note's wait has no tempo, and
it needs its own diff back into the definition. Editing in place on a use has
the context for free.

**Edits inside a use changing the definition.** Every accidental tweak rewrites
every use, and restarts all of them.
