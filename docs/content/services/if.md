# If

Evaluates a structural pattern against incoming data and conditionally routes it through a nested sub-pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-rt | `if` |

---

## What it does

If checks whether the incoming data matches a configured `condition` (a JSON subset pattern). If the condition matches, the data is routed through a nested `pipeline` of services and the result is early-returned from the outer pipeline — downstream outer services are skipped. If the condition does not match, the data passes through to the next outer service unchanged.

### Condition matching

The condition is evaluated as a structural subset test with AND semantics: every key–value pair in `condition` must be present and equal in the incoming data. Nested objects are matched recursively. For `MixedData` the condition is checked against the meta field; for plain JSON it is checked against the JSON object directly.

```json
{ "method": "GET" }
```

Matches when the incoming data has `method == "GET"`.

```json
{ "method": "POST", "path": "/upload" }
```

Both `method` and `path` must match (AND).

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `condition` | `object` | JSON pattern; all key–value pairs must match for the branch to execute |
| `pipeline` | `ServiceDescriptor[]` | Ordered list of services to run when the condition is true |

### Dynamic pipeline management

Pipelines can be modified at runtime without replacing the full config:

| Property | Effect |
|---|---|
| `appendService: { serviceId, state? }` | Appends a service to the end of the pipeline |
| `removeService: "<instanceId>"` | Removes the service with the given instance ID |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any — checked against `condition` |
| **Output (match)** | Result of the nested `pipeline` (early return) |
| **Output (no match)** | Original input, forwarded to the next outer service |

---

## Example: route POST requests to a handler

```json
{
  "serviceId": "if",
  "state": {
    "condition": { "method": "POST" },
    "pipeline": [
      { "serviceId": "map", "instanceId": "extract-body", "state": { "template": { "body=": "params.body" } } }
    ]
  }
}
```

POST requests are processed by the inner Map; GET and other requests skip the branch entirely.
