# Blocks

A configured service — usually a sub-service and the pipeline inside it —
defined once in a board and used wherever a pipeline names it.

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

- **It is locked on screen.** A use wears a bar — the block's name, its params,
  its actions — and its panel is out of reach (`inert`) and dimmed, as is every
  level opened inside it. An edit made there would be thrown away on save, which
  is worse than not being able to make it.
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
board. Blocks defined in files, shared across boards, are where the two are
expected to become one.

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
| Adding a use from the palette | `hkp-frontend/src/core/serviceOperations.ts` (`addService`) |
| The bar, the lock, the edit bar | `hkp-frontend/src/runtime/ui/BlockUse.tsx` |
| Refusing addresses into a use | `hkp-frontend/src/facade/boardServices.ts` |
| Worked example | `boards/nested-rhythm-demo-board.json` |
| Tests | `runtime/board/tests/blocks.test.ts`, `core/tests/linkBlocks.test.ts`, `core/tests/block-use.integration.test.ts`, `e2e/tests/blocks.spec.ts` |

---

See also: **Presets** (`concepts/presets.md`) for the verb blocks share a document
with, **Scopes** (`concepts/scopes.md`) for the sub-service boundary most blocks
are, and **Units and compositions** (`concepts/units.md`) for composing at the
size of a board.
