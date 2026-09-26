# SubService

A service that contains its own ordered pipeline — the primary way to build a higher-level block out of smaller ones.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `sub-service` |
| hkp-node | `sub-service` |
| hkp-python | `sub-service` |
| hkp-rt | `sub-service` |

The browser runtime adds a second mode of its own; see
[Browser Sub-Service](./browser-sub-service.md).

---

## What it does

A runtime is an ordered list of services, and that order is the wiring. A
SubService is one entry in that list holding a list of its own: input goes in at
the head of the nested pipeline, and what comes out the end is the SubService's
own output.

That is the whole of it by default — which makes it a way of naming a group of
services and reusing them. Two further settings turn it into a
[scope](../concepts/scopes.md): a boundary that says whether its answer leaves
and what its contents can see.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pipeline` | `PipelineEntry[]` | `[]` | The ordered services inside |
| `bypass` | `boolean` | `false` | Skip the pipeline; the input passes through |
| `stopPropagation` | `boolean` | `false` | Whether what the pipeline produced leaves this service |
| `scope` | `{ slots }` | `{ slots: "own" }` | What the services inside can see |

### `stopPropagation`

Absent means `false`, so a board that says nothing about it passes its result
along exactly as before.

Set, it closes **both** ways out: the value `process()` answers with, *and*
anything the pipeline emitted without being asked — a Timer tick, or a service
that answered nothing and came back later. A scope holding something
asynchronous needs both, or it goes on driving the board after its own answers
have stopped.

It composes with `bypass`; the two together are a
[`stopper`](./stopper.md).

### `scope.slots`

Which cells a [`hold`](./hold.md) inside this pipeline reaches.

| Value | Which cells |
|---|---|
| `"own"` (default) | This service's, so two copies of one pipeline do not collide and a slot named inside means nothing outside |
| `"inherit"` | The runtime's, so a slot named inside is the same cell as one named beside it |

The default is the reusable case: a block whose slot names leaked into its
surroundings would clash with a second copy of itself. Two Holds that must meet
across the boundary need it to say `"inherit"`.

### What a configure replaces

In every runtime, a configure naming `pipeline` **replaces the whole pipeline**:
the services inside are rebuilt from the entries given, so whatever an entry no
longer says is gone rather than left over from before. Whatever runs inside
restarts — a Timer's schedule, say. The one exception is a pipeline that differs
only in names, which the browser renames in place without rebuilding.

Every other field is applied **only when present**: a configure that does not
mention `stopPropagation` or `scope` leaves them as they were. To put one back,
name it with its default.

[Blocks](../concepts/blocks.md) rely on both: a use is refreshed by configuring
it with its whole definition, its own fields filled in with the defaults above.

---

## Addressing what is inside

A service in a nested pipeline is named by the path through the services holding
it, dot-separated:

```json
{ "serviceUuid": "list.kept-articles", "path": "rows" }
```

This works for everything a board does with a service — reading one in a facade
widget, processing one from a button, configuring one, a notice, and a
[`hkp-mount://`](../concepts/mounts.md) reference. Nested services report under
their address too, so what a widget binds to is what the service says.

Entering a nested service runs it and what follows it *inside that pipeline*,
not in the runtime's own list.

See [Scopes](../concepts/scopes.md) for the whole arrangement and why it exists.

---

## Pipeline entry shape

```json
{
  "serviceId": "hookup.to/service/monitor",
  "instanceId": "shown",
  "serviceName": "What was held",
  "state": {}
}
```

`instanceId` is unique within its own pipeline, which is why an address is the
path and not the bare name.

---

## Typical uses

**A reusable block.** A group of services given one name, dropped into a board
as one entry:

```
http-client → SubService (parse → filter → shape) → sql
```

**Two flows on one runtime.** Each its own scope, neither reaching the other:

```
read  (stopPropagation: true)   →  nothing continues
  └ rss

list                            ←  entered by the facade
  └ tracks → sql → … → http-server-subservices
```

**An endpoint's document, held between passes.** The scope owns the cells, so a
second endpoint on the same runtime may use the same slot name:

```
SubService (scope.slots: "own")
  └ sql → map → http-server-subservices
                  ├─ onProcess: Hold (slot: document, op: write)
                  └─ onRequest: Hold (slot: document, op: read)
```
