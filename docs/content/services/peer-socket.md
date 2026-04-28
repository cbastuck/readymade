# Peer Socket

Establishes a named peer-to-peer WebSocket connection for sending or receiving pipeline data between boards or runtimes.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/peer-socket` |

---

## What it does

Peer Socket connects to the board's peer signalling infrastructure and registers under a `peerName`. It can send outgoing pipeline values to a named `targetPeer`, receive incoming data from other peers and inject it into its own pipeline, or both simultaneously.

When a message arrives from the target peer, it is pushed downstream via `app.next()` — independently of any upstream pipeline trigger.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `"Receive only"` \| `"Send only"` \| `"Receive and Send"` | `"Receive only"` | Whether the service sends, receives, or both |
| `peerName` | `string` | Random `"NoNameN"` | Name this peer registers under |
| `targetPeer` | `string` | Random `"NoNameN"` | Name of the peer to send to (in Send or Receive and Send modes) |
| `extractIncomingData` | `boolean` | `false` | When `true`, only the `data` field of the incoming message is injected into the pipeline |
| `peerPort` | `number \| null` | `null` | Port override for the peer server |
| `peerHost` | `string \| null` | `null` | Host override for the peer server |
| `peerPath` | `string \| null` | `null` | Path override for the peer server WebSocket endpoint |

### Receiving data

When `mode` includes `"Receive"`, the service listens for `{ incoming: <data> }` configure calls from the peer infrastructure and injects the data downstream.

### Sending data

When `mode` includes `"Send"`, each value that arrives via `process()` is transmitted to `targetPeer` over the peer WebSocket connection.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — sent to `targetPeer` in Send mode |
| **Output** | Data received from the peer, injected via `app.next()` |

---

## Typical use

Connect two boards running in different browser tabs or devices:

- Board A: `... → Peer Socket (Send only, peerName: "device-a", targetPeer: "device-b")`
- Board B: `Peer Socket (Receive only, peerName: "device-b") → ...`
