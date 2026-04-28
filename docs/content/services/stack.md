# Stack

Nests a sub-pipeline of services as a single, reusable processing unit.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/stack` |

---

## What it does

Stack embeds an ordered list of services inside a single service card.
The sub-pipeline runs when the Stack receives upstream data, exactly as a
normal runtime pipeline would. This allows you to build reusable
processing blocks and compose complex graphs from simpler, named units.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `services` | `ServiceDescriptor[]` | `[]` | The ordered list of sub-services |
| `input` | `"multiplex" \| "lanes"` | `"multiplex"` | How incoming data is distributed to sub-services |
| `output` | `"array"` | `"array"` | How sub-service results are collected |

### Input modes

| Mode | Behaviour |
|---|---|
| `"multiplex"` (default) | Fans the incoming value out to each sub-service independently; all results are collected and returned as an array |
| `"lanes"` | Treats the incoming array as parallel lanes: `params[i]` is routed to sub-service `i`. If the input is not an array, it is routed to the first sub-service only. |

### Output

Stack always collects the results of all sub-services into an array. `null` results are included in their index position.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value |
| **Output** | Result of the sub-pipeline, or an array of results in `"array"` output mode |

---

## Typical use

Use Stack to encapsulate a reusable transform (e.g. "normalise sensor
data") that appears on multiple boards or in multiple positions on the
same board. The Stack's configuration can be saved and restored as part
of the Board Blueprint like any other service.
