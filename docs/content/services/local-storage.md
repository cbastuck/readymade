# Local Storage

Reads key–value pairs from the browser's `localStorage` and emits them as an array.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/local-storage` |

---

## What it does

Local Storage queries `window.localStorage`, optionally filtered to keys starting with a given prefix, and emits an array of `{ key, value }` objects. The cache is refreshed on each `process()` call and whenever `filter` is updated.

This service is read-only — it does not write to localStorage. To write, use the [Hacker](./hacker.md) service (`dangerous` variant) or a Map with a side-effect expression.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `filter` | `string` | `""` | Key prefix filter. Only keys starting with this string are included. Empty string = all keys. |
| `process` | `boolean` | — | When `true`, immediately fires the current item list downstream via `app.next()` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any (ignored; triggers a fresh read of localStorage) |
| **Output** | `Array<{ key: string, value: string }>` |

---

## Example: read all keys with a prefix

```json
{ "filter": "board." }
```

Returns all localStorage entries whose key begins with `"board."`.
