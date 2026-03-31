# Canvas

Renders 2D draw commands — text, shapes, images, and video — onto an HTML canvas element.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/canvas` |

---

## What it does

The Canvas service receives a draw object (or array of draw objects) from
the pipeline and renders them onto an HTML `<canvas>` element displayed
in its service card. Each frame the canvas is optionally cleared before
drawing, creating smooth animations.

The service does not emit data downstream by default. In **capture mode**
it encodes each rendered frame as a Blob and emits it, allowing
downstream services to record, stream, or process frames.

---

## Canvas configuration

Set via the service's `state` in the Board Blueprint or through the UI.

| Property | Type | Default | Description |
|---|---|---|---|
| `size` | `[number, number]` | `[480, 240]` | Canvas width and height in pixels |
| `clearOnRedraw` | `boolean` | `true` | Fill with white before each frame |
| `resizable` | `boolean` | `true` | Allow the user to drag-resize the canvas |
| `fullscreen` | `boolean` | `false` | Expand to fill the available viewport |
| `capture` | `boolean` | `false` | Encode each frame as a Blob and emit downstream |
| `captureMime` | `string` | `"image/png"` | MIME type for captured frames |

---

## Coordinate system

All positional values (`x`, `y`, `width`, `height`, `radius`) accept:

- **Numbers** — absolute pixel positions
- **Percentage strings** — `"50%"` resolves relative to the canvas
  dimension in that axis (`"50%"` on a 400 px wide canvas → 200 px)

When `x` or `y` are omitted from a draw element, the element is
horizontally or vertically centred.

---

## Draw element types

Pass a single object or an **array** of objects. Each object must have a
`type` field.

### `text`

Renders a text string.

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | — | The string to render |
| `x` | `number \| string` | centred | Left edge of the text baseline |
| `y` | `number \| string` | centred | Vertical text baseline position |
| `font` | `string \| FontObject` | browser default | CSS font string or font object |
| `color` | `string` | `"#000"` | Fill colour |
| `contour` | `{color, lineWidth?}` | — | Optional text outline |
| `textTransform` | `string` | — | `"uppercase"`, `"lowercase"`, `"lowercase-spacing-1"`, … |
| `onClick` | `action` | — | Action dispatched when the text area is clicked |

**Font object:**

```json
{ "style": "italic", "weight": "bold", "size": "24px", "family": "Arial" }
```

`size` may also be a percentage string (`"5%"`) relative to canvas width.

### `circle`

| Field | Type | Default | Description |
|---|---|---|---|
| `x` | `number \| string` | centred | Centre X |
| `y` | `number \| string` | centred | Centre Y |
| `radius` | `number \| string` | — | Radius in px or `%` of canvas height |
| `color` | `string` | — | Fill colour |
| `contour` | `{color, lineWidth?}` | — | Stroke |
| `gradient` | `{from, to, colors[]}` | — | Radial gradient descriptor |

### `rect` / `square`

`square` is an alias for `rect`.

| Field | Type | Default | Description |
|---|---|---|---|
| `x` | `number \| string` | centred | Left edge |
| `y` | `number \| string` | centred | Top edge |
| `width` | `number \| string` | — | Width |
| `height` | `number \| string` | — | Height |
| `length` | `number \| string` | — | Sets both `width` and `height` (square shorthand) |
| `color` | `string` | — | Fill colour |
| `contour` | `{color, lineWidth?}` | — | Stroke |

### `image`

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | Remote image URL (cached after first fetch) |
| `data` | `Blob \| HTMLImageElement` | — | Inline image data |
| `x` | `number \| string` | centred | X position of the image centre |
| `y` | `number \| string` | centred | Y position of the image centre |
| `height` | `number \| string` | natural | Rendered height (aspect-ratio preserved) |
| `opacity` | `number` | `1` | Alpha (0–1) |
| `unscaled` | `boolean` | `false` | Draw at natural pixel size |
| `onClick` | `action` | — | Click handler |

### `video`

Renders a single frame from a video Blob.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Blob` | — | Video data |
| `x` | `number \| string` | `0` | X position |
| `y` | `number \| string` | `0` | Y position |
| `width` | `number \| string` | canvas width | Rendered width |
| `height` | `number \| string` | canvas height | Rendered height |

### `array`

Renders a 1D numeric array as a vertical bar chart.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `number[]` | — | Array of values |
| `color` | `string` | `"#000"` | Bar fill colour |

### `array2d`

Renders a 2D numeric array as a grid of coloured cells.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `number[][]` or flat `number[]` | — | Grid data |
| `cols` | `number` | — | Number of columns (required for flat arrays) |
| `rows` | `number` | — | Number of rows |

### `explainer`

Renders a pointer line with a label — useful for annotating other elements.

| Field | Type | Default | Description |
|---|---|---|---|
| `pointer` | `{x, y, length}` | — | Start point and line length |
| `direction` | `"left" \| "right"` | `"right"` | Direction the line extends |
| `text` | `string` | — | Label text |
| `font` | `string \| FontObject` | — | Font |
| `color` | `string` | `"#000"` | Colour |
| `textTransform` | `string` | — | Text transform |

---

## Multiple elements in one frame

Pass an array to draw several elements per frame:

```json
[
  { "type": "circle", "x": 200, "y": 150, "radius": 120, "contour": { "color": "#ccc", "lineWidth": 1 } },
  { "type": "text",   "x": 280, "y": 150, "text": "HKP", "color": "#3b82f6", "font": "bold 22px Arial" }
]
```

---

## Capture mode

When `capture: true`, after each render the canvas is encoded as a Blob
(format controlled by `captureMime`) and emitted downstream. This allows
you to chain a Canvas with an Output service to stream frames over a
WebSocket, or a Buffer to batch frames.

```json
{
  "size": [640, 480],
  "capture": true,
  "captureMime": "image/jpeg"
}
```
