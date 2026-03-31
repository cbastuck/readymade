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
| `input` | `"default" \| "multiplex" \| "array"` | `"default"` | How incoming data is distributed to sub-services |
| `output` | `"default" \| "array"` | `"default"` | How sub-service results are collected |

### Input modes

| Mode | Behaviour |
|---|---|
| `"default"` | Passes the incoming value through the sub-pipeline in order |
| `"multiplex"` | Fans the incoming value out to each sub-service independently; results collected |
| `"array"` | Treats the incoming array as a list of items, running each through the sub-pipeline individually |

### Output modes

| Mode | Behaviour |
|---|---|
| `"default"` | Emits the final value from the sub-pipeline |
| `"array"` | Collects the result from each sub-service into an array and emits the array |

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
