# Sequencer

Steps through an ordered list of data values, emitting one value per pipeline trigger.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/sequencer` |

---

## What it does

Sequencer maintains an ordered list of steps, each holding an arbitrary
data payload. Each time the service receives an upstream trigger, it
advances to the next step and emits that step's payload downstream. When
it reaches the last step it either stops or loops back to the beginning
depending on the `repeat` setting.

---

## Configuration

Steps are assigned via the UI by dragging content onto step slots.
Programmatic configuration:

| Property | Type | Default | Description |
|---|---|---|---|
| `repeat` | `boolean` | `false` | Loop back to step 0 after the last step |
| steps data | per-step objects | — | The payload associated with each step; set via UI drag-and-drop or `configure` |

### Commands

| Action | Description |
|---|---|
| Advance (implicit) | Each pipeline trigger moves to the next step |
| Checkpoint | Jump to a named position in the sequence |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — used only as a trigger signal, the value itself is discarded |
| **Output** | The data payload stored at the current step |

The service notifies its UI of the current step index on each advance so
the UI can highlight the active step.

---

## Typical use

- **Step sequencer**: pair with a Timer to advance automatically at a
  fixed BPM.
- **Tutorial flow**: each button press (TriggerPad) advances to the next
  instructional slide.
- **State machine**: each step holds configuration for a different
  operating mode.

```
Timer (100 ms) → Sequencer → Map → Canvas
```

Each Timer tick advances the Sequencer by one step; the Map transforms
the step payload into a canvas draw command.
