# Output

Sends the current pipeline value to a remote endpoint via HTTP POST or WebSocket.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/output` |

---

## What it does

Output is the egress point of a browser pipeline. On each pipeline
trigger it serialises the current data to JSON and delivers it to a
configured URL, either over a persistent WebSocket connection or as an
HTTP POST request.

Combined with the [Input](./input.md) service, Output is the standard
way to bridge data between two runtimes — or from a browser pipeline to
any external system.

---

## Modes

| Mode | Description |
|---|---|
| `websocket` | Maintains a persistent WebSocket connection; sends each value as a JSON message |
| `post` | Sends an HTTP POST request with the JSON body for each pipeline trigger |

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | Destination URL (`ws://`, `wss://`, `http://`, `https://`) |
| `mode` | `"websocket" \| "post"` | `"websocket"` | Delivery mechanism |
| `flow` | `"stop" \| "pass"` | `"stop"` | Whether to continue the pipeline after sending |
| `headers` | `Record<string, string>` | `{}` | HTTP headers (for `post` mode) |
| `bypass` | `boolean` | `false` | Skip sending; disconnect WebSocket if open |

### `flow`

| Value | Behaviour |
|---|---|
| `"stop"` (default) | Pipeline terminates at Output; nothing downstream receives data |
| `"pass"` | Data is sent AND the original input continues to the next service |

Use `"pass"` when Output is a side-effect in the middle of a longer
pipeline, e.g. logging to a server while also rendering to Canvas.

### `headers`

Static header values are strings. Dynamic headers (values evaluated at
send time) use the same `=`-suffix syntax as the Map service:

```json
{
  "Authorization=": "\"Bearer \" + params.token",
  "Content-Type": "application/json"
}
```

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any JSON-serialisable value |
| **Output (flow: stop)** | `null` — pipeline stops |
| **Output (flow: pass)** | Original input, unchanged |

---

## Example: streaming to a remote runtime

Send each timer tick to a remote hkp-rt WebSocket server:

```json
{
  "url": "ws://my-server.example.com:9000/input",
  "mode": "websocket",
  "flow": "stop"
}
```

## Example: HTTP POST with auth header

Post data to a REST endpoint on each trigger:

```json
{
  "url": "https://api.example.com/events",
  "mode": "post",
  "flow": "stop",
  "headers": {
    "Content-Type": "application/json",
    "X-Api-Key": "my-secret-key"
  }
}
```
