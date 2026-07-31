# Map

Transforms pipeline data by applying a declarative template to produce a new JSON object.

---

## Overview

The Map service takes incoming data (`params`) and applies a **template** to produce a new object. Templates can mix static values with dynamic expressions evaluated against the incoming data. This makes Map the primary tool for reshaping, renaming, and computing derived values within a pipeline.

**Available in:**
- Browser Runtime — service ID `hookup.to/service/map`
- hkp-rt — service ID `map`
- hkp-node — service ID `map`
- hkp-python — service ID `map`

The browser, hkp-rt and hkp-node services share the same template dialect, the same
modes and the same UI. hkp-python implements the flat-template subset (no nested or
array templates, no inject command).

---

## Template Syntax

A template is a JSON object. Keys and values follow specific conventions to distinguish static from dynamic content.

### Static Properties

A key without a trailing `=` is copied verbatim into the output:

```json
{ "label": "hello", "version": 2 }
```

### Dynamic Expressions

A key ending with `=` marks a **dynamic term**. The `=` suffix is stripped from the key name in the output, and the value is evaluated as an expression against the incoming data:

```json
{ "angle=": "params.triggerCount * 0.1" }
```

This produces `{ "angle": <computed value> }` in the output.

### Scalar Output

When the template contains a single key equal to `"="` (empty string after stripping `=`), the result is a **scalar value** rather than an object:

```json
{ "=": "params.value * 2" }
```

The pipeline receives the raw computed value, not a wrapper object.

### Nested Keys (Dot Notation)

A dot in a key name creates a nested structure in the output:

```json
{ "position.x=": "params.triggerCount", "position.y": 0 }
```

Produces:

```json
{ "position": { "x": <value>, "y": 0 } }
```

### Array Input

If the incoming `params` is an array, the template is applied independently to each element and the output is an array of mapped objects. Set `arrayMode` to `"single"` to map the array as one value instead.

### Nested and Array Templates

A template that nests objects or contains arrays keeps its shape; every level is evaluated with the same rules, so a dynamic term can sit anywhere in the structure:

```json
[{ "role": "user" }, { "text=": "params.message" }]
```

---

## Expression Scope

Expressions have access to the incoming data via `params` and to a set of built-in functions:

| Function | Signature | Description |
|---|---|---|
| `sin` | `sin(n)` | `Math.sin` |
| `round` | `round(n)` | `Math.round` |
| `min` | `min(a, b)` | `Math.min` |
| `max` | `max(a, b)` | `Math.max` |
| `rand` | `rand()` | `Math.random` — returns a float in [0, 1) |
| `number` | `number(x)` | Converts a string to a number |
| `string` | `string(x)` | Converts a value to a string |
| `concat` | `concat(a, b)` | Concatenates two strings |
| `stringify` | `stringify(x)` | `JSON.stringify` |
| `parse` | `parse(s)` | `JSON.parse` |
| `sum` | `sum(arr)` | Sum of a numeric array |
| `avg` | `avg(arr)` | Average of a numeric array |
| `slice` | `slice(arr, offset, step, end)` | Slices and downsamples an array |
| `moment` | `moment(...)` | [moment.js](https://momentjs.com/) date/time library |
| `uuid.v4` | `uuid.v4()` | Generates a random UUID v4 |
| `uuid.v7` | `uuid.v7()` | Generates a time-ordered UUID v7 |
| `fromVault` | `fromVault(globalId)` | Reads a value from the user vault |
| `toVault` | `toVault(globalId, value)` | Writes a value to the user vault |
| `encodeURI` | `encodeURI(s)` | Standard `encodeURI` |
| `reformatDate` | `reformatDate(date, inputFmt, outputFmt)` | Reformats a date string using moment.js |
| `fromQueryParam` | `fromQueryParam(name)` | Reads a URL query parameter from `window.location` |
| `fromStorage` | `fromStorage(name)` | Reads a value from `localStorage` |
| `print` / `log` | `print(x)` | `console.log` (useful for debugging) |
| `find` | `find(arr, 'item.x > 1')` | First element matching an expression-string predicate (`item`, `index` in scope) |
| `filter` | `filter(arr, 'item.x > 1')` | All elements matching the predicate |
| `isFuture` / `isPast` | `isFuture(ts)` | Timestamp checks for anything `Date` accepts |
| `formatNow` | `formatNow('YYYY-MM-DD')` | Current time formatted with moment tokens |
| `flatSum` | `flatSum(arr)` | Sum of a nested numeric array |
| `at` | `at(arr, i)` | Element at a wrapped index |
| `range` | `range(n)` | `[0, 1, … n-1]` |
| `slug` | `slug(s)` | Lowercases and strips everything outside `[a-z0-9_-]` |
| `now` | `now()` | Epoch milliseconds |

**Note:** `Math.cos` is not directly available. To compute cosine, use the identity `sin(θ + 1.5708)` (i.e. sin(θ + π/2)).

**Runtime differences:** `moment`, `fromVault`, `toVault`, `fromQueryParam` and `fromStorage` exist only in the browser runtime — they need a browser or the user vault. hkp-rt and hkp-node provide everything else, including `reformatDate`/`formatNow` over the moment token subset `YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm m ss s A a` and `[escaped literals]`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `template` | `object` \| `array` | `{}` | The mapping template. See Template Syntax above. |
| `mode` | `"replace"` \| `"add"` \| `"overwrite"` | `"replace"` | Controls how the output is merged with the input. |
| `arrayMode` | `"array"` \| `"single"` | `"array"` | Whether an array input is mapped element by element or as one value. |
| `sensingMode` | `boolean` | `false` | When `true`, the Map auto-learns the template from the first input then disables itself. |

### `mode` Values

| Value | Behaviour |
|---|---|
| `replace` | Output contains only the properties defined in the template. Input properties not in the template are discarded. |
| `add` | Template properties are merged into the input, but existing input keys are **not** overwritten by template values. |
| `overwrite` | Input properties are merged first, then template properties overwrite them. |

### `sensingMode`

When `sensingMode: true`, the first input object that arrives is used to automatically construct a template (flattened key structure, static values). After this first input the service sets `sensingMode` back to `false` and returns `null` for that first item. Subsequent items are processed normally using the learned template.

### `command.inject`

Sending `{ command: { action: "inject", params: { ... } } }` causes the Map to immediately process the provided `params` through the template and emit the result downstream, without waiting for an external trigger.

---

## Error Handling

If expression evaluation fails, the Map logs the error to the console and returns the **original input unchanged** (identity pass-through).

---

## Example: Circle Animation

Map a timer tick to a circle draw command using trigonometric functions:

```json
{
  "type": "circle",
  "x=": "sin(params.triggerCount * 0.05) * 40 + 50",
  "y=": "sin(params.triggerCount * 0.05 + 1.5708) * 40 + 50",
  "radius": 10,
  "color": "#3498db"
}
```

This produces a `circle` draw object whose `x` and `y` trace a circular path as `triggerCount` increments. Connect this Map to a Canvas service to animate the circle.

---

## hkp-rt: Inja Templates

Alongside the `=`-suffix convention, the hkp-rt Map also renders **Inja** (a C++ Jinja2-like template engine) strings, so templates written before the shared dialect keep working. A string value — or a key — carrying `{{` or `{%` is rendered by Inja against the incoming data rather than evaluated as an expression:

```json
{ "angle": "{{ value }}" }
```

Note the difference in scope: an Inja template addresses the incoming data directly (`{{ value }}`), while an expression addresses it through `params` (`"angle=": "params.value * 0.1"`). Inja's own filters and functions apply inside `{{ }}`; the built-in table above applies inside expressions.
