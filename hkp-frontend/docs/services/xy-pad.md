*A 2D touch/drag surface that emits normalised x/y coordinates on every interaction.*

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/xy-pad` |

---

## What it does

XYPad displays an interactive 2D surface in its service card. As the
user moves a pointer (mouse or touch) across the surface, it
continuously emits the current position as a JSON object. The pad
optionally divides its area into a grid of discrete cells.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `gridRows` | `number` | `0` | Number of discrete rows; `0` = continuous |
| `gridCols` | `number` | `0` | Number of discrete columns; `0` = continuous |

When `gridRows` and `gridCols` are both `0`, the pad emits a continuous
normalised position. When set, the pad snaps to cell centres and emits
the cell index alongside the position.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Ignored — XYPad generates its own triggers on interaction |
| **Output** | `{ x: number, y: number, eventType: string, timestamp: number }` |

- **`x`**, **`y`**: normalised position in the range `[0, 1]`; `(0, 0)` is the top-left corner
- **`eventType`**: the pointer event type (`"pointermove"`, `"pointerdown"`, `"pointerup"`)
- **`timestamp`**: `performance.now()` at the time of the event

In grid mode, additional fields `col` and `row` (zero-indexed integers)
are included.

---

## Example uses

- Feed `x` and `y` into a Map service to control audio parameters, canvas
  positions, or API request values.
- Gate output through a Filter that only passes `eventType === "pointerdown"`
  to react to click/tap events only.
- Use a `gridRows: 4, gridCols: 4` configuration as a 16-step pad
  controller.
