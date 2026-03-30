*A grid of assignable buttons; pressing a pad sends its configured payload into the pipeline.*

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/trigger-pad` |

---

## What it does

TriggerPad displays a grid of pads in its service card. Each pad can
have an arbitrary JSON payload assigned to it. When a pad is pressed
(or triggered programmatically) it fires that payload through the
downstream pipeline.

The service has an "armed" pad concept: one pad is designated the
currently active pad, and it can be advanced programmatically.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `padAssignments` | `Record<number, any>` | `{}` | Map of pad index → payload to emit |
| `armedPad` | `number` | `0` | Index of the currently active/armed pad |

### Commands

Send as `command.action` to trigger behaviour programmatically:

| Action | Params | Description |
|---|---|---|
| `"trigger-pad"` | `{ padIndex: number }` | Fire the payload of the specified pad |
| `"clear-pad"` | `{ padIndex: number }` | Remove the payload assignment for a pad |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Ignored (pads fire independently on user interaction) |
| **Output** | The JSON payload assigned to the triggered pad |

---

## Example: assign payloads to three pads

```json
{
  "padAssignments": {
    "0": { "action": "start", "speed": 1.0 },
    "1": { "action": "stop" },
    "2": { "action": "reset", "speed": 0.5 }
  },
  "armedPad": 0
}
```

Pressing pad 0 emits `{ "action": "start", "speed": 1.0 }` into the
pipeline.
