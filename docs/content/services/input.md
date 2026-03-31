# Input

Connects to a remote stream and injects each arriving message as a new pipeline trigger.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/input` |

---

## What it does

Input opens a persistent connection to a URL and, on every message
received, runs the full downstream pipeline with that message as its
input. It is the counterpart to the [Output](./output.md) service, and
the standard way to pull a continuous data stream from another runtime
or external source into a browser pipeline.

The connection is established as soon as a URL is configured and
re-established automatically if it drops.

---

## Modes

| Mode | Protocol | Use case |
|---|---|---|
| `eventsource` (default) | HTTP Server-Sent Events (SSE) | One-way streaming from server to browser; auto-reconnects |
| `websocket` | WebSocket | Bidirectional, low-latency messaging |

The mode is detected automatically when a `ws://` or `wss://` URL is
provided. A URL starting with `http://` or `https://` always uses
`eventsource`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | The stream endpoint URL |
| `mode` | `"eventsource" \| "websocket"` | `"eventsource"` | Connection mode (auto-detected from URL scheme) |
| `parseEventsAsJSON` | `boolean` | `true` | Parse message bodies as JSON before emitting |
| `bypass` | `boolean` | `false` | When `true`, explicitly disconnects and stops receiving |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Ignored — Input generates its own pipeline triggers |
| **Output** | Each incoming message, optionally parsed as JSON |

When `parseEventsAsJSON` is `true` (the default) and a message body is
valid JSON, the parsed object is emitted. If parsing fails the raw
string is emitted as a fallback.

---

## Typical use: pairing with Output

The most common pattern is to place an **Output** service at the end of
one runtime's pipeline to push data over a WebSocket, and an **Input**
service at the start of another pipeline to receive it:

```
Browser Runtime A          Browser / Remote Runtime B
──────────────────         ────────────────────────────
Timer → Map → Output ─WS─► Input → Process → Canvas
                    url="ws://localhost:9000/stream"
```

Output configuration on Runtime A:
```json
{ "url": "ws://localhost:9000/stream", "mode": "websocket", "flow": "stop" }
```

Input configuration on Runtime B:
```json
{ "url": "ws://localhost:9000/stream", "mode": "websocket" }
```
