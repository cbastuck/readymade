# WebSocket

Four hkp-rt services for bidirectional WebSocket communication: reader, writer, server, and client.

---

## Available in

| Runtime | Service IDs |
|---|---|
| hkp-rt | `websocket-reader`, `websocket-writer`, `websocket-server`, `websocket-client` |

These services are not available in the browser runtime. For browser-side
WebSocket connectivity use [Input](./input.md) and [Output](./output.md).

---

## Overview

The four services cover the two axes of WebSocket communication:

| | Accepts connections (passive) | Initiates connections (active) |
|---|---|---|
| **Receives data** | `websocket-reader` | `websocket-client` |
| **Sends data** | `websocket-writer` | `websocket-server` |

Mix and match based on which side initiates and which side produces data.

---

## websocket-reader

Listens on a local port for an incoming WebSocket connection. When a
client connects and sends a message, the message is emitted downstream as
a pipeline trigger.

### Configuration

| Property | Type | Description |
|---|---|---|
| `host` | `string` | Interface to listen on (e.g. `"0.0.0.0"`) |
| `port` | `string` | Port number to bind |
| `path` | `string` | URL path to accept connections on (e.g. `"/stream"`) |

### Input / Output

- **Input**: ignored
- **Output**: each received WebSocket message, parsed as JSON if valid

---

## websocket-writer

Sends what passes through to a WebSocket somewhere else, one message per pass,
and hands the pass on unchanged. It connects **outward**, so a runtime behind a
NAT can feed a server that could never reach it. For example, a home machine
can stream to a relay in the cloud ([Live Radio (Cloud, direct)](../boards/live-radio-cloud-direct-demo-board.md)).

### Configuration

| Property | Type | Description |
|---|---|---|
| `url` | `string` | `ws://…` or `wss://…`. An `http(s)://` address is taken to mean the WebSocket at the same place. `hkp-mount://<runtime>/<service>` names an endpoint instead (see below) |
| `path` | `string` | Appended to a mount's address, e.g. `/live.mp3` |
| `headers` | `object` | Sent with the handshake; `{{secret.<alias>}}` in a value is resolved for the host being connected to |
| `maxQueueBytes` | `number` | How much may wait while the connection is slow or down (default 16384, about a second at 128 kbit/s); past it the oldest messages are dropped |

**Nothing waits on the network.** Each pass is queued and handed on at once. A
thread of the service's own connects, writes one message at a time, and
reconnects with backoff (0.5 s, doubling to 10 s) when the connection drops.
Keep-alive pings detect a connection that died without closing. For anything
live, the newest data is what matters, which is why the queue drops the oldest.

**A mount reference** works like [http-client](./http.md#calling-an-endpoint-whose-address-is-assigned-at-load-time):
the board's coordinator writes the endpoint's address into `__hkpMount`, and the
writer connects to that address plus `path`. Until then its status is `waiting`.

### Input / Output

- **Input**: bytes are sent as binary messages; text and JSON as text
  messages; MixedData's binary as bytes; a ring buffer as its serialised samples
- **Output**: the input, unchanged

State reports `status` (`idle`, `waiting`, `connecting`, `connected`,
`reconnecting`), the last `error`, the `target` actually dialled, and
`sentBytes`, `droppedMessages` and `reconnects`.

**The older form.** Boards that give `host`, `port` and `path` instead of `url`
connect over plain `ws://` and open with the `{"type":"writer"}` hello that
hkp-rt's own websocket-server uses to pair a writer.

---

## websocket-server

Hosts a WebSocket server and broadcasts each upstream pipeline value to
all currently connected clients.

### Configuration

| Property | Type | Description |
|---|---|---|
| `host` | `string` | Interface to bind (e.g. `"0.0.0.0"`) |
| `port` | `string` | Port to listen on |
| `path` | `string` | Accepted connection path |

### Input / Output

- **Input**: any JSON value — broadcast to all connected clients
- **Output**: passes through to next service

---

## websocket-client

Connects to a remote WebSocket server and emits each incoming message
from the server as a pipeline trigger (mirroring `websocket-reader` but
on the initiating side).

### Configuration

| Property | Type | Description |
|---|---|---|
| `host` | `string` | Remote server hostname |
| `port` | `string` | Remote server port |
| `path` | `string` | URL path on the remote server |

### Input / Output

- **Input**: ignored
- **Output**: each message received from the remote server

---

## Typical patterns

### Bridge: browser → hkp-rt

Browser Output sends to a WebSocket URL; hkp-rt websocket-reader receives:

```
Browser:  Timer → Map → Output (ws://hkp-rt:9000/in)
hkp-rt:   websocket-reader (port 9000) → FFT → monitor
```

### Bridge: hkp-rt → browser

hkp-rt websocket-server pushes to browser Input:

```
hkp-rt:   core-input → fft → websocket-server (port 9001)
Browser:  Input (ws://hkp-rt:9001) → Canvas
```
