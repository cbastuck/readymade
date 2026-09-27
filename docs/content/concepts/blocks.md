# Blocks

A configured sub-service — and the pipeline inside it — defined once in a board
and used wherever a pipeline names it.

---

## The problem

A pipeline repeats itself. In a drum pattern, *play a sound, then wait* appears
dozens of times, and so does *two hi-hats, the first accented*. Written out, each
repetition is a full copy: the same services, the same state, a different
number here and there. The board gets long, and changing the idea means finding
and changing every copy.

A preset does not help with that. It is a service's configuration *applied* — a
copy, from then on independent of where it came from. What a repeated idea
wants is a **reference**: one definition, many places that name it, and what
varies between them said at each place.

Nor does a unit. A unit is half an app and contributes whole runtimes; a block is
a piece of a pipeline, and sits inside one.

---

## What is added to a board

Definitions in the board's `blocks`, and **uses** in any pipeline:

```json
"blocks": [
  {
    "id": "note",
    "name": "Note",
    "serviceId": "sub-service",
    "params": { "trigger": "hihat", "volume": 0.5, "beats": 0.5 },
    "state": {
      "scope": { "slots": "inherit" },
      "pipeline": [
        { "block": "hit", "instanceId": "hit",
          "params": { "trigger": "{{param.trigger}}", "volume": "{{param.volume}}" } },
        { "serviceId": "hookup.to/service/timer", "instanceId": "wait",
          "state": { "oneShotDelay": "{{param.beats}}", "oneShotDelayUnit": "beats" } }
      ]
    }
  }
]
```

```json
{ "block": "note", "instanceId": "kick", "params": { "trigger": "kick", "volume": 0.9 } }
```

A **definition is a preset used by reference**: the same fields — `id`, `name`,
`serviceId`, `serviceName`, `description`, `state` — read by the same parser,
without the `"preset"` marker, since `blocks` already says what it is. `params`
declares every parameter the state refers to, with the value it has when a use
says nothing.

**A block is a sub-service** (`sub-service`, or `hookup.to/service/sub-service`)
whose state has a `pipeline`; a definition naming any other service is refused
when the board opens. A use is refreshed — its params changed, its block's
definition applied or an edit cancelled — by configuring the running service
with its definition, and a sub-service configured with a pipeline rebuilds it in
every runtime (`services/sub-service.md`), so what a definition no longer says
is gone from every use. The sub-service's own fields are applied only when named,
so each use is configured with all of them, filled in with their defaults where
the definition leaves them out. Other services take a configure as a patch, and
would keep what a definition dropped. A single service is made a block by
wrapping it in a sub-service.

A **use** stands where a service would. It carries the id the service would
have (`instanceId` in a pipeline, `uuid` in a runtime's own list), and a use
written without one is given one when the board opens. `serviceName` renames it;
`params` gives values.

### Parameters

`{{param.name}}` anywhere in a definition's state. A reference that is a whole
string takes the value as it is — a number stays a number — and one inside a
longer string is written into it as text. A reference with no value is left in
place and warned about.

Parameters are **lexical**: inside a definition, `{{param.x}}` is that block's.
A block used inside another is handed what it needs through its own `params`,
which may refer to the outer block's — that is how *Note* passes `trigger` to
*Hit*. A parameter may even name a block, `{ "block": "{{param.beat}}" }`, so
one definition can be told which block to repeat.

A unit's parameters (`concepts/units.md`) share the syntax and not the scope:
they are substituted into a unit's services — including the params its uses pass
— and never into its `blocks`.

---

## A use is frozen while the board runs

Opening a board **expands** every use into the service it stands for. No runtime
knows blocks exist; what is provisioned is an ordinary board.

Saving **writes each use back** as the board holds it — as it was written, with
the params set on it since. Nothing running is compared against anything. That
is what makes the model small, and it rests on one rule: **the inside of a use
belongs to its definition.** So:

- **It is locked on screen.** A use shows a bar — the block's name, its params,
  its actions — in place of its panel, which appears only once the use is
  edited or detached. A level opened on it shows what is inside, out of reach
  (`inert`) and dimmed. An edit made there would be thrown away on save, which
  is worse than not being able to make it. What only reads stays reachable: a
  service's configuration opens read-only, and a panel that locks its own
  controls instead (the Timeline's, whose editor opens as a read-only view)
  keeps what shows details. What a use passes on is the use's own, so its
  output plug sits beside the bar, where the Flow Inspector opens as it does on
  any service.
- **Nothing addresses it.** A facade widget or a Configurator naming a service
  inside a use is refused when it is called, and warned about when the board is
  opened. A use is addressed as a whole. This is a board rule, not a security
  boundary: a remote runtime's own API still reaches the service.
- **Runtime state inside a use is live only.** Whatever a service inside one
  learns or reports while running is not saved — the way a Timer's `running` is
  not.

What a use does take:

| | |
|---|---|
| **Params** | from its bar. A change re-instantiates that use and configures it with the result; for a sub-service only its own pipeline rebuilds |
| **Detach** | turns the use into an ordinary copy of what it expanded to, saved from then on as whatever runs. The uses inside it stay uses |
| **Edit block** | unlocks this use as a working copy of the definition, in its real context. **Apply** makes the copy the definition and re-instantiates every use of it; **Cancel** puts the copy back |
| **Remove** | takes it out of its pipeline |

When a definition is edited, **param-driven fields belong to the use**. Where the
definition held `{{param.x}}`, the reference is kept, and a value changed there
becomes the working copy's param; everything else becomes the definition's, for
every use. A reference inside a longer string cannot be traced back once the
text changes, so the new text is kept and the change is warned about.

---

## Making one, and using it again

**Make block**, in a sub-service's menu, turns it into a definition and the
service into its first use — nothing about what runs changes. Blocks already
inside it stay uses. The board's blocks then appear in the **Building Blocks**
sidebar, and dropping one on a runtime adds a new use with its default params.

Services that are not yet in a sub-service are made a block in one step.
**Shift-click** a service's header to pick it, and shift-click another in the
same runtime to pick everything between the two — always a run, since a
runtime's order is its wiring and a run with a gap in it could not be wrapped
without rewiring what was left out. While services are picked, the runtime's
header offers **Wrap in SubService** and **Make block**; so does the menu of any
picked service. Make block asks for a name, wraps the run in a sub-service
where it was, and makes that the block's first use. On its own, any service at
the top of a runtime offers Make block in its menu, wrapping just itself. Escape,
or selecting another runtime, lets the picked services go.

Wrapping keeps the board doing what it did:

- The services are recreated inside the sub-service from the configuration they
  report, under their own ids — so what they were set to carries over, and what
  they only held while running (a recording, a timer's position) starts again.
- The sub-service reads the runtime's slots (`scope.slots: "inherit"`), so a
  Hold or a tempo reader inside reaches the cells it reached before.
- A service inside a sub-service finds others by id only within it. A
  Configurator or ProcessRouter whose target is on the other side of the new
  boundary, or an `hkp-mount://` reference to a service in the run, would stop
  resolving, so the wrap is **refused** and says which. A reference with both
  ends in the run moves with it.
- A facade addressing a service in the run is rewritten to reach it through the
  sub-service (`the-hit` becomes `<sub-service>.the-hit`). A block's inside is
  not addressable, so Make block refuses such a run instead.
- Uses of blocks in the run stay uses, inside the new sub-service.

Only services at the top of a runtime can be picked; a sub-pipeline's own
services cannot yet.

### Blocks from the library

A block need not start in the board. The [preset library](presets.md) holds
sub-service presets, and one that declares `params` is offered in the same
sidebar as a block: shipped with the build (**ntfy notification**), imported
from a file or a URL, or saved from a service. Dropping it **copies its
definition into the board's `blocks`** and places a use of it — from then on it
is the board's own block, exactly as if it had been made there:

- The board opens anywhere, without the library, and a share link carries the
  definition.
- A second drop, of the same block, uses the copy the board already holds —
  under whatever id it has there — rather than copying it again. One that
  differs from a board block with the same id is given a free id (`ntfy-2`).
- The library's version changing later — edited, or updated from its source —
  does not reach the board's copy. Edit the board's block, or drop the newer
  one beside it.

The copy leaves behind what is the library's business: the `preset` marker and
`origin`.

---

## Where a board goes

| | Blocks |
|---|---|
| Saving, drafts and snapshots | kept: the documents, with their uses |
| Share link, board source | kept for the board's own blocks; a unit's uses are expanded, since the link carries no unit to name |
| Deploying | expanded: a coordinator is handed what runs, the way a bundle is |
| Units | each document keeps its own. A unit's uses resolve against the unit's blocks, never the composition's, and save back into the unit |

---

## Presets and blocks

The two are one idea with two verbs. A preset is a service's configuration
**applied** — copied, and independent from then on. A block is the same
document **used** — referenced, and following its definition. Presets take
`params` too: applying one substitutes its defaults, which is a use detached the
moment it is made.

What still differs: a preset is keyed by the service it configures and its id,
and lives in files and the preset library; a block is named by its id within one
board. The library is where they meet: a sub-service preset with params is
dropped as a block, its definition copied into the board. A use never names the
library itself, so a board depends on nothing outside it.

---

## Known gaps

- **Moving a use to another pipeline** writes it back expanded: it is found by
  its id within the pipeline it was placed in.
- **Nested drops.** The palette adds a use to a runtime's own services; inside a
  sub-pipeline a block is not yet offered by its selector.
- **Mobile** locks uses and their insides, and shows params, but the mobile
  sheet only drills into a remote runtime's sub-services — as for any service.
- **Applying an edit closes a level open on the working copy**, since its
  pipeline is rebuilt.

---

## Where it lives in the code

| Concern | Where |
|---|---|
| Expanding, writing back, params, detach, the working copy | `hkp-frontend/src/runtime/board/blocks.ts` |
| Parameter substitution, shared with presets | `hkp-frontend/src/runtime/board/params.ts` |
| Definitions read as presets; presets with params | `hkp-frontend/src/core/presets.ts` (`parseBlockDefinition`, `presetState`) |
| Linking into a board and its units, and back out; address checks | `hkp-frontend/src/core/linkBlocks.ts` |
| What a person does to a use | `hkp-frontend/src/core/blockActions.ts` |
| Wrapping picked services, and making a block of them | `hkp-frontend/src/runtime/board/wrap.ts` (what may be wrapped), `hkp-frontend/src/core/wrapActions.ts` (doing it), `hkp-frontend/src/ui-components/runtime-ui/WrapSelection.tsx` |
| Picking services | `hkp-frontend/src/selection/SelectionContext.tsx`, `hkp-frontend/src/runtime/ServiceUiContainer.tsx` |
| Adding a use from the palette | `hkp-frontend/src/core/serviceOperations.ts` (`addService`) |
| Copying a library block into a board | `hkp-frontend/src/runtime/board/blocks.ts` (`withAdoptedDefinition`), `core/presets.ts` (`isUsableAsBlock`) |
| Blocks the build ships | `hkp-frontend/presets/sub-service/`, listed in `src/presetRegistry.ts` |
| The bar, the lock, the edit bar | `hkp-frontend/src/runtime/ui/BlockUse.tsx` |
| Refusing addresses into a use | `hkp-frontend/src/facade/boardServices.ts` |
| Worked example | `boards/nested-rhythm-demo-board.json` |
| Tests | `runtime/board/tests/blocks.test.ts`, `runtime/board/tests/wrap.test.ts`, `core/tests/linkBlocks.test.ts`, `core/tests/block-use.integration.test.ts`, `core/tests/wrap-services.integration.test.ts`, `e2e/tests/blocks.spec.ts` |

---

See also: **Presets** (`concepts/presets.md`) for the verb blocks share a document
with, **Scopes** (`concepts/scopes.md`) for the sub-service boundary most blocks
are, and **Units and compositions** (`concepts/units.md`) for composing at the
size of a board.
