*Four hkp-rt services for bidirectional WebSocket communication: reader, writer, server, and client.*

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

Connects to an existing WebSocket server and sends each upstream pipeline
value as a JSON message.

### Configuration

| Property | Type | Description |
|---|---|---|
| `host` | `string` | Remote server hostname |
| `port` | `string` | Remote server port |
| `path` | `string` | URL path on the remote server |

### Input / Output

- **Input**: any JSON value — serialised and sent
- **Output**: `null` by default (terminates pipeline); the original input
  if `flow: "pass"` is set

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
