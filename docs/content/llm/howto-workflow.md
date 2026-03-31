# How to Build a Service Workflow — Circle Text Example

This guide walks through building a complete workflow that renders text
moving along a circular path in a Canvas service. It covers the pipeline
model, how each service is configured, how data flows between them, and
how to export and restore a board.

---

## Architecture overview

The platform uses a **pipeline model**: services within a runtime are
ordered in a list. When the runtime processes data, each service receives
the output of the previous service as its input. A service returning
`null` stops the chain.

```
Timer ──► Map ──► Canvas
```

| Layer  | Role                                                           |
|--------|----------------------------------------------------------------|
| Timer  | Emits a tick object every N ms with an incrementing counter   |
| Map    | Transforms the tick into a canvas draw command using expressions |
| Canvas | Receives the draw command and renders it via CanvasUI          |

---

## Step 1 — Add a Browser Runtime

Every service needs a runtime to run in. Add a browser runtime from
the runtime picker. It appears in the board with an empty service list.

A runtime serialises as:

```json
{
  "id": "rt-browser-1",
  "name": "Browser Runtime",
  "type": "browser",
  "state": {
    "wrapServices": false,
    "minimized": false
  }
}
```

---

## Step 2 — Add and configure the Timer service

Add a **Timer** service (`hookup.to/service/timer`) as the first service
in the runtime.

### What it emits

On every tick the Timer calls `app.next()` with:

```json
{ "triggerCount": 42 }
```

`triggerCount` is an integer that increments on every tick and resets to
zero when the timer is restarted.

### Configuration

| Property       | Type    | Description                            |
|----------------|---------|----------------------------------------|
| `periodicValue`| number  | How long between ticks                 |
| `periodicUnit` | string  | Unit: `"ms"`, `"s"`, `"m"`, …         |
| `periodic`     | boolean | Enable repeating mode                  |
| `running`      | boolean | Start the timer immediately on restore |

For smooth animation at ~20 fps, use 50 ms:

```json
{
  "periodicValue": 50,
  "periodicUnit": "ms",
  "periodic": true,
  "running": true
}
```

---

## Step 3 — Add and configure the Map service

Add a **Map** service (`hookup.to/service/map`) after the Timer.

### What Map does

Map transforms its input object into a new object according to a
`template`. Each key in the template is either:

- A **static property** — value is copied as-is.
  ```
  "type": "text"
  ```
- A **dynamic expression** — key ends with `=`, value is a JS expression
  evaluated with `params` bound to the current pipeline input.
  ```
  "x=": "round(200 + 120 * sin(params.triggerCount * 0.05 + 1.5708))"
  ```
  The `=` suffix is stripped from the output key, so this produces `"x"`.

### Available expression functions

The expression evaluator exposes a safe global scope (no raw `Math`
object). Key available names:

| Name       | Equivalent to      |
|------------|--------------------|
| `sin`      | `Math.sin`         |
| `round`    | `Math.round`       |
| `min`      | `Math.min`         |
| `max`      | `Math.max`         |
| `rand`     | `Math.random`      |
| `string`   | `String(x)`        |
| `number`   | `Number(x)`        |
| `concat`   | `` `${x}${y}` ``   |
| `sum`      | sum of array       |
| `avg`      | average of array   |
| `moment`   | moment.js          |

> **Note — no `cos`:** The global scope does not expose `Math.cos`.
> Use the identity `cos(θ) = sin(θ + π/2)` instead:
>
> ```
> sin(params.triggerCount * speed + 1.5708)   // ≈ cos(triggerCount * speed)
> ```
>
> `1.5708` ≈ π/2.

### Circular motion formula

To make a point travel in a circle of radius `r` around center `(cx, cy)`:

```
x(t) = cx + r * cos(t)   →   round(cx + r * sin(t + 1.5708))
y(t) = cy + r * sin(t)   →   round(cy + r * sin(t))
```

Where `t = triggerCount * speed`. Choose `speed` to control how fast the
circle is traversed — a full revolution takes `2π / speed` ticks.

| Speed  | Ticks per revolution | Time at 50 ms/tick |
|--------|----------------------|--------------------|
| 0.10   | ~63                  | ~3.1 s             |
| 0.05   | ~126                 | ~6.3 s             |
| 0.02   | ~314                 | ~15.7 s            |

### Canvas text draw element

The canvas `update()` function accepts objects with a `type` field.
For text:

| Field          | Type              | Description                                   |
|----------------|-------------------|-----------------------------------------------|
| `type`         | `"text"`          | Required                                      |
| `text`         | string            | The string to render                          |
| `x`            | number or `"N%"`  | Pixel offset from left (omit to horizontally center) |
| `y`            | number or `"N%"`  | Pixel offset from top baseline (omit to vertically center) |
| `font`         | string or object  | CSS font string e.g. `"bold 22px Arial"`      |
| `color`        | string            | Fill color e.g. `"#3b82f6"`                  |
| `contour`      | `{color, lineWidth}` | Optional text outline                      |
| `textTransform`| string            | `"uppercase"`, `"lowercase"`, `"lowercase-spacing-1"`, … |
| `onClick`      | action            | Optional click handler dispatched via `app.next` |

### Map configuration for this workflow

```json
{
  "template": {
    "type": "text",
    "text": "HKP",
    "color": "#3b82f6",
    "font": "bold 22px Arial",
    "x=": "round(200 + 120 * sin(params.triggerCount * 0.05 + 1.5708))",
    "y=": "round(150 + 120 * sin(params.triggerCount * 0.05))"
  },
  "mode": "replace"
}
```

On each tick this produces something like:

```json
{
  "type": "text",
  "text": "HKP",
  "color": "#3b82f6",
  "font": "bold 22px Arial",
  "x": 320,
  "y": 150
}
```

with `x` and `y` changing on every tick to trace the circle.

---

## Step 4 — Add and configure the Canvas service

Add a **Canvas** service (`hookup.to/service/canvas`) as the last service
in the runtime.

### How it works

The Canvas service passes the received draw command to `CanvasUI` via
`app.notify()`. CanvasUI calls `update()` which dispatches to the
appropriate draw function based on the `type` field, then renders to an
`<canvas>` element.

`clearOnRedraw: true` (the default) clears the canvas with a white fill
before each frame, preventing trails.

### Configuration

```json
{
  "size": [400, 300],
  "clearOnRedraw": true,
  "resizable": true
}
```

`size` is `[width, height]` in pixels. The canvas starts at 400×300 by
default. The user can resize it by dragging the resize handle if
`resizable` is `true`.

---

## Step 5 — Run the board

With all three services in order, the board is live:

1. The Timer fires every 50 ms.
2. Its output `{ triggerCount: N }` reaches the Map.
3. Map evaluates the circle expressions and emits a `text` draw object.
4. Canvas receives it and renders the text at the new position.
5. The canvas is cleared before each frame so only the current position
   is visible — the text appears to travel smoothly around the circle.

---

## Step 6 — Export the board configuration

To export the current board state, open the board menu and choose
**Edit Board Source**. The JSON shown is produced by `serializeBoard()`
and has this shape:

```json
{
  "boardName": "Circle Text",
  "runtimes": [
    {
      "id": "<runtime-id>",
      "name": "Browser Runtime",
      "type": "browser",
      "state": { "wrapServices": false, "minimized": false }
    }
  ],
  "services": {
    "<runtime-id>": [
      {
        "uuid": "<service-uuid>",
        "serviceId": "hookup.to/service/timer",
        "serviceName": "Timer",
        "state": { ... }
      }
    ]
  }
}
```

Each service's `state` is whatever `getServiceConfig()` returns for that
service — i.e. its persisted configuration.

The complete board JSON for this example is saved alongside this document
at [`circle-text-board.json`](./circle-text-board.json).

---

## Complete board JSON

```json
{
  "boardName": "Circle Text",
  "runtimes": [
    {
      "id": "rt-browser-1",
      "name": "Browser Runtime",
      "type": "browser",
      "state": {
        "wrapServices": false,
        "minimized": false
      }
    }
  ],
  "services": {
    "rt-browser-1": [
      {
        "uuid": "svc-timer-1",
        "serviceId": "hookup.to/service/timer",
        "serviceName": "Timer",
        "state": {
          "periodicValue": 50,
          "periodicUnit": "ms",
          "periodic": true,
          "running": true
        }
      },
      {
        "uuid": "svc-map-1",
        "serviceId": "hookup.to/service/map",
        "serviceName": "Map",
        "state": {
          "template": {
            "type": "text",
            "text": "HKP",
            "color": "#3b82f6",
            "font": "bold 22px Arial",
            "x=": "round(200 + 120 * sin(params.triggerCount * 0.05 + 1.5708))",
            "y=": "round(150 + 120 * sin(params.triggerCount * 0.05))"
          },
          "mode": "replace"
        }
      },
      {
        "uuid": "svc-canvas-1",
        "serviceId": "hookup.to/service/canvas",
        "serviceName": "Canvas",
        "state": {
          "size": [400, 300],
          "clearOnRedraw": true,
          "resizable": true
        }
      }
    ]
  }
}
```

---

## Adapting this workflow

**Different text:** Change `"text"` in the Map template to any string.
Use `"●"` for a dot, `"★"` for a star, or multi-character labels.

**Different speed:** Change the `0.05` multiplier in both expressions.
Double it (`0.10`) for twice the speed; halve it (`0.025`) for half.

**Different radius:** Change `120` in both expressions. Values up to
~140 keep the text inside the 400×300 canvas.

**Different centre:** Change `200` (horizontal) and `150` (vertical) to
any pixel position within the canvas.

**Multiple draw elements:** Change the `process` flow so the Map outputs
an array — or chain a second Map that wraps the single object in an array
— to draw additional elements (e.g. a static circle outline with
`type: "circle"`) alongside the moving text.

**Slower ticks:** Increase `periodicValue` (e.g. to `100` for 10 fps)
to reduce CPU usage; the motion becomes choppier but the pipeline
overhead drops.
