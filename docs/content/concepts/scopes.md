# Scopes

A boundary inside a runtime: a group of services that runs as one flow, keeps what it holds to itself, and says for itself whether its answer leaves.

---

## The problem it solves

A runtime is an ordered list, and that order is the wiring. One board, one chain.
But a board often has **two flows on one runtime** — kept together because they
share a database, or a unit, or simply because splitting them across runtimes
would cost a round trip for nothing.

The RSS reader is the plain case. Fetching feeds is one flow; keeping an article
and publishing the reading list is another. They share a database and nothing
else: a refresh must not reach the statement that saves an article, or every
round would insert sixty rows nobody asked for.

Before scopes, the way to say that was a [`stopper`](../services/stopper.md)
between them:

```
feeds → Stopper → record-article → kept-articles → … → feed-serve
```

That works, and it says very little. It states that nothing continues past a
point, and leaves the reader to infer that everything *above* it belongs to one
flow, that everything *below* is entered from somewhere else, and that a service
added in the wrong place would silently join the wrong half. The boundary is a
convention held up by list order.

A scope says it of itself:

```
read  (stopPropagation: true)        list
  └ feeds                              └ record-article → kept-articles → … → feed-serve
```

---

## A scope is a SubService

There is no `scope` service. A scope is a
[`sub-service`](../services/sub-service.md) using either of two capabilities —
and one that uses neither is the SubService that has always existed.

```json
{
  "uuid": "read",
  "serviceId": "sub-service",
  "serviceName": "Reading the feeds",
  "state": {
    "stopPropagation": true,
    "scope": { "slots": "own" },
    "pipeline": [ … ]
  }
}
```

Giving it a separate service id was considered and rejected: identical mechanics
would fork the implementation across four runtimes and make board authors choose
between two things that behave the same. If the word should be visible in a
board, it is a `serviceName` — which costs nothing and is per instance.

---

## `stopPropagation`

Whether what the pipeline produced leaves the service. **Default `false`, and an
absent field means `false`**, so every board written before scopes goes on
passing its result along.

It closes **both** ways out, and that is the whole of the work:

| Route | What it is |
|---|---|
| The answer | `process()` returns nothing, so the services after this one do not run |
| The push | what the pipeline emitted *without being asked* — a Timer tick, or a service that answered nothing and came back later — is dropped rather than carried past |

The second one is easy to miss and is usually the one that matters. An `rss`
service returns nothing from `process` and pushes its articles once the feeds
answer; a scope that closed only the first route would let every one of those
articles through. A scope that holds anything asynchronous needs both closed, or
it goes on driving the board long after its own answers have stopped.

It composes with `bypass`, which a SubService already had:

| `bypass` | `stopPropagation` | |
|---|---|---|
| — | — | the pipeline runs, its result continues |
| — | ✓ | the pipeline runs, nothing continues |
| ✓ | — | the pipeline is skipped, the input continues |
| ✓ | ✓ | the pipeline is skipped, nothing continues — a Stopper |

---

## `scope`

What the services inside can see, as one block rather than keys added one at a
time. Today it has one member.

```json
"scope": { "slots": "own" }
```

`slots` decides which cells a [`hold`](../services/hold.md) inside this scope
reaches — its own, or the runtime's.

**`own` is the default**, and the reason is reuse. A SubService is the primary
way to build a higher-level block out of smaller ones, and a block whose slot
names leaked into its surroundings would collide with a second copy of itself.
Two Holds that must meet *across* a scope boundary need that boundary to say so:

```json
"scope": { "slots": "inherit" }
```

The same rule holds one level up: an endpoint owns the cells its two entry
pipelines share, which is why two endpoints on a runtime may both call a slot
`document` without meeting.

A scope's panel says which of the two it got, under a **Slots** line that also
says how many cells there are. The line is all it shows until it is opened,
because a cell holds whatever a pipeline put in it — an article, a frame, a
document — and a panel that drew every value would be mostly somebody else's
data. Open it and the slot *names* appear, which is what a board is written in
terms of; open a name and that one cell's value appears under it.

Inherited cells are drawn greyed and a scope's own in the panel's text colour,
because the difference is about who else can reach them — an inherited cell is
shared with everything else out there naming that slot, so it is not this
scope's to account for.

Which of the two it is sits at the end of that same line, as a setting wearing
what every other setting in a service panel wears — unlabelled, because the
line is already headed Slots and the two values say themselves what they mean.
It is the one thing about a scope's cells a panel offers to change, because the
rest is what other pipelines left behind. Changing it **re-points the cells and
rebuilds nothing** — the scope asks for its store on every lookup, so a Timer
or a socket inside goes on running. A scope's own cells outlive the trip, too:
they live on the service rather than on the pipeline, so a value held before a
detour through the inherited ones is still there on the way back.

Each slot carries a **bin**, and that is the only thing the panel does to a
cell. What is in one is the pipelines' to write; what is worth doing from
outside is taking a cell away, so that a board can be put back to before
anything ran without hunting for the service that filled it. Removing is not
the same as emptying — an empty cell is one a board named and nothing has
filled yet, and a Hold reading either answers the same nothing — but it leaves
no stale reading behind, and the next write brings the name back.

This is all a browser-runtime reading, and the reason is distance: the store is
an object in the same process as the panel, so it can be listed, watched and
reached into directly. A scope on a REST runtime would have to report its cells
in its state before a panel could draw them.

`secrets` and `logging` are the members most likely to follow — which
credentials a scope's children can resolve, and logging turned on for one scope
and nothing else. Neither exists yet. The block is shaped for them so they do
not arrive as scattered sibling keys.

---

## Addressing what is inside

A runtime's services are a flat list, and a uuid names one of them. A scope's
are not in that list, so they are named by the path through the services holding
them:

```json
{ "serviceUuid": "list.kept-articles", "path": "rows" }
```

`serviceUuid` is the address; `path` still means the field inside that service's
state. They stay separable, which is what lets an address nest without becoming
ambiguous — `read.list.feed-doc` is three services, not a field called `list`.

**The separator is a dot, and that is forced rather than chosen.** A service
address is carried in a URL path segment
(`/runtimes/<id>/services/<address>`), which a slash would split. The same
constraint already decided the separator between a unit's name and its runtime
ids.

Everything a board does with a service works at an address: a facade widget
reading one, a button processing one, a `configure` action, a notice, and a
[`hkp-mount://`](./mounts.md) reference naming an endpoint inside a scope.

Two consequences worth knowing:

- **A service reports under its address, always.** Each boundary prefixes its
  own uuid as a notification passes outward, because an instanceId is unique
  only inside its own pipeline. There is no moment — not even while a nested
  service is being configured — when it speaks under a name the board cannot
  dial.
- **Entering a scope at one of its services runs the rest of that scope.**
  Processing `list.record-article` runs it and what follows it *inside* `list`,
  which is written down, rather than "whatever happens to come next" in the
  runtime's own list.

---

## Where a scope is entered

A scope that passes nothing on cannot be reached by the chain, which is the
point — so it is entered by being addressed. In the RSS reader, the facade's
Save and Remove buttons process `list.record-article`, and nothing else ever
enters that half of the board.

That is the real gain over a stopper. With a stopper, "the reading list is
entered from the facade" is true but unwritten: it follows from where the
stopper sits. With scopes, the second flow is a thing with a name, and what runs
when you enter it is what is written inside it.

---

## What runs where

All four runtimes carry the same contract, so a board means the same thing
wherever it runs.

| | Browser | hkp-node | hkp-python | hkp-rt |
|---|---|---|---|---|
| `stopPropagation` | both routes | both routes | the answer only¹ | both routes |
| `scope.slots` | ✓ | ✓ | ✓ | ✓ |
| Scoped addressing | ✓ | ✓ | ✓ | ✓ |

¹ hkp-python has no second route out: its SubService never carries a nested
service's unprompted output past itself, so there is nothing there to close.

An endpoint inside a scope works on the runtimes that have endpoints — a nested
pipeline has no server of its own, so it claims its address on the runtime
around it. The name it derives from falls back to the scoped address, so two
copies of one scope do not take each other's callers; a board that named its
mount keeps the address it published before being scoped.

---

## When not to reach for one

A scope is a boundary, not a folder. Wrap something in one because its answer
should stop, or because its cells should be its own — not to tidy a long list.
A SubService that does neither is exactly what it always was, and the board
gains a level of nesting for nothing.

And a scope is not [Tracks](../services/tracks.md). Tracks is one call fanned
out over several pipelines and reduced back to one answer; a scope is many calls
over time sharing what they left behind. Two pipelines that must both run on the
same input are tracks. Two flows with different triggers are scopes.
