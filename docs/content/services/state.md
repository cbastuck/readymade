# State

Maintains a configurable key–value store and expands macro templates against incoming data.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/state` |

---

## What it does

State is a general-purpose store that holds an arbitrary JSON state object and a map of named macros. On each `process()` call it applies the macros to the incoming data:

- Each item in the input array is inspected for a `type` field.
- If `type` is `"macro:<name>"`, the macro named `<name>` is looked up, its `$value` placeholders are substituted with the item's matching fields, and the expanded template is returned in place of the original item.
- Items without a macro `type` are returned unchanged.

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `macros` | `MacroMap` | Named macros. Each macro has `variables` (keys to substitute) and a `template` (object or array of objects with `$value` placeholders) |

### Macro shape

```json
{
  "greeting": {
    "variables": ["name"],
    "template": { "text": "Hello, $value", "key": "name" }
  }
}
```

An input item `{ "type": "macro:greeting", "name": "Alice" }` expands to `{ "text": "Hello, Alice", "key": "name" }`.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Array of objects |
| **Output** | Array with macro-typed items expanded into their template values |

---

## Notes

State does not persist between sessions. For cross-session persistence use [Local Storage](./local-storage.md) or the vault functions available in [Map](./map.md) expressions (`fromVault` / `toVault`).
