# Switch

Routes its input into the first of several sub-pipelines whose condition holds: the structured if/else of a board.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/switch` |

---

## What it does

Each **case** pairs a condition with a pipeline. The Switch evaluates the conditions in order against its input, and the first that is truthy runs its pipeline on that input; what the pipeline answers is what the Switch answers. When no case matches, the `default` pipeline runs; with no default either, the input passes through unchanged. A matched case with an empty pipeline also passes the input through.

Conditions are expressions over `params`, the input: `params.kind == 'audio'`, `params.count > 3`, or, for an input that is a plain value, `params == 'swing'`.

---

## A case is a branch, not a scope

A case's pipeline belongs to the pipeline the Switch sits in, the way the body of an `if` belongs to the code around it:

- **Slots.** Its services hold values in the [slots](./hold.md#where-its-cells-live) of whatever holds the Switch, not in cells of their own. A value set outside the Switch is visible inside every case. A [scope](../concepts/scopes.md) is the thing that keeps cells to itself; a case does not.
- **Activity.** What happens inside a case is reported outward under `<switch>.<instanceId>`, so a panel or the board overview outside sees it, and a facade can address a service in a case by that path. Because the case is not part of the address, an `instanceId` must be unique across all of a Switch's cases.
- **Cancelling.** A scope that is [cancelled](./browser-sub-service.md#commands) ends the passes running inside its Switches' cases too.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `cases` | `{ when, pipeline }[]` | `[]` | The cases, tried in order. `when` is an expression over `params`; `pipeline` is a list of pipeline entries (see [Browser Sub-Service](./browser-sub-service.md#pipeline-entry-shape)). |
| `default` | pipeline entries | `[]` | Runs when no case matches. |
| `ignoreInnerResult` | `boolean` | `false` | Answer with the original input instead of the case pipeline's result: the case runs for its effects. |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value; conditions see it as `params` |
| **Output** | The matched pipeline's result (or the input, with `ignoreInnerResult`); the input unchanged when nothing matched and there is no default |

---

## Example

The [Nested Rhythm](../boards/nested-rhythm-demo-board.md) board picks one of four drum patterns per bar. A [Hold](./hold.md) reads the chosen pattern's name out of a slot, and the Switch routes the bar into the pattern with that name:

```json
{
  "serviceId": "hookup.to/service/switch",
  "instanceId": "patterns",
  "state": {
    "cases": [
      { "when": "params == 'straight'", "pipeline": [ { "serviceId": "sub-service", "instanceId": "straight", "state": { … } } ] },
      { "when": "params == 'shuffle'",  "pipeline": [ { "serviceId": "sub-service", "instanceId": "shuffle",  "state": { … } } ] }
    ]
  }
}
```
