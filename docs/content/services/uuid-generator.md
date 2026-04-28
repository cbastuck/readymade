# UUID Generator

Generates a UUID on every pipeline tick and emits it or merges it into the incoming object.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/uuid-generator` |

---

## What it does

UUID Generator produces a new UUID each time `process()` is called (or when triggered via `configure({ action: "generate" })`). The UUID version is configurable, and the output mode controls whether the UUID is emitted as a plain string or merged into the incoming value.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `method` | `"v1"` \| `"v4"` | `"v4"` | UUID version. `v4` is random; `v1` is time-based. |
| `mode` | `"plain"` \| `"merge"` | `"plain"` | Output mode. `plain` emits the UUID string directly; `merge` adds a `uuid` key to the incoming object. |
| `action: "generate"` | — | — | Triggers immediate UUID generation and emission via `app.next()` |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value (only used in `merge` mode) |
| **Output (plain)** | UUID string, e.g. `"a3bb189e-8bf9-3888-9912-ace4e6543002"` |
| **Output (merge)** | `{ ...params, uuid: "<generated-uuid>" }` |

---

## Example: tag each pipeline value with a unique ID

```json
{ "method": "v4", "mode": "merge" }
```

Input: `{ "data": "hello" }`
Output: `{ "data": "hello", "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }`
