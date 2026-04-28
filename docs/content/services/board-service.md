# Board Service

Runs a saved board as a sub-pipeline, forwarding incoming data through it and emitting the result.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/board-service` |

---

## What it does

Board Service lets you embed one board inside another. When it receives a value via `process()`, it delegates it to the UI layer, which routes it through the selected board and resolves the result. This makes complex, reusable processing graphs composable without duplicating service configurations.

Boards can be selected from the user's saved board library via the `selectedBoard` property.

---

## Configuration

| Property | Type | Description |
|---|---|---|
| `selectedBoard` | `string` | Name or identifier of the saved board to run |
| `result` | `any` | Internal — used by the UI to deliver a result back into the pipeline |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — passed to the selected board's first service |
| **Output** | Result of running the selected board on the input |

---

## How it works

1. An upstream service emits a value.
2. Board Service's `process()` posts a `command: { action: "process", params, promise }` notification to the UI.
3. The UI runs the incoming data through the selected board and resolves the promise with the result.
4. The result is emitted downstream as the next pipeline value.

The board is executed synchronously from the calling pipeline's perspective (the promise resolves before the pipeline continues).
