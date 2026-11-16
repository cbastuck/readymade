# MQTT Broker

An MQTT broker inside the board: clients connect and talk through it, and the board hears and speaks as well.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `mqtt-broker` |

---

## What it does

A broker is the middle of MQTT: clients connect to it, subscribe to topics and
publish under them, and the broker passes each message to whoever subscribed.
This service is one, running in the board's Node runtime. Devices, other
programs and the board's own [MQTT](./mqtt.md) services — on a Node runtime or
in the browser — connect to it and reach each other through it.

The board takes part from both sides:

- **What clients publish enters the pipeline.** Each message under one of
  `topics` becomes a pass through the services after this one, and on to the
  next runtime. `topics` is `#` — everything — unless told otherwise; an empty
  list hands nothing on and leaves the broker a hub between its clients.
- **What the pipeline hands it is published.** An input shaped
  `{ "topic": …, "payload": … }` goes to every client subscribed to that topic.
  With `topic` set, any input is published under it. An input that names no
  topic passes through untouched. What the board publishes this way is not
  handed back to it.

Sessions, subscriptions and retained messages are kept in memory: they go when
the board is closed or the service is switched off.

### Where clients connect

Like every endpoint on hkp-node, the broker binds no port of its own. It is
served as **MQTT over WebSockets** at an address its runtime assigns, shown on
the panel and published in the service's state as `__hkpMount`:

```
ws://<host>:<port>/hosted/<id>
```

The address is stable — it survives reloads, restarts and redeploys — and
unguessable, which is what gates it. An MQTT service on the same board does
not need to know it; it names the broker instead:

```json
"url": "hkp-mount://node/hub"
```

See [mounts](../concepts/mounts.md) for how such an address comes about.

### A password

Setting `password` — usually a secret reference, `{{secret.broker}}` — asks
every client for it, on top of knowing the address. MQTT carries a password
only beside a username, so a client must send one: any, unless `username`
says which. Changing the password disconnects everybody, and whoever held the
old one is not let back in.

### A port, for devices

Many devices speak only plain MQTT over TCP — a host and a port, nothing else.
Setting `port` (conventionally `1883`) opens one beside the WebSocket address;
both lead to the same broker.

A port is different from an assigned address: it is a port of the machine,
found by anyone who can reach it. So:

- it is off until `port` is set;
- it needs a `password`, and stays closed without one;
- the connection is not encrypted — use it on a network you trust;
- a hosted server (`HKP_EGRESS=public`) refuses it. Several people's boards
  share that machine, and its ports are not a board's to take. A hosted board
  is reached at its WebSocket address.

When the port cannot be opened, `error` says why.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `bypass` | `boolean` | `true` | `false` switches the broker on |
| `topics` | `string[]` | `["#"]` | Which of the messages clients publish enter the pipeline. Also accepted as one line, comma-separated |
| `topic` | `string` | `""` | What an input is published under when it names no topic itself |
| `qos` | `number` | `0` | For messages the pipeline publishes that say nothing else |
| `retain` | `boolean` | `false` | Keep each message the pipeline publishes for later subscribers |
| `format` | `string` | `"auto"` | How a payload handed on is read: `auto` (JSON where it is JSON, else text), `text` or `binary` |
| `username` | `string` | `""` | The username clients must present. Empty accepts any |
| `password` | `string` | `""` | The password clients must present, usually `{{secret.<alias>}}`. Empty asks for none |
| `port` | `number` | `0` | A TCP port for plain MQTT. `0` opens none |
| `mountName` | `string` | — | What the WebSocket address is derived from, instead of the service's id. Renaming rotates the address |

### Read-only state fields

| Field | Type | Description |
|---|---|---|
| `__hkpMount` | `string` | The assigned address, as `http(s)://…` — an MQTT client is given it as `ws(s)://…` |
| `listening` | `number` | The TCP port being listened on, or `0` |
| `error` | `string` | Why the port is not open, if it is not |
| `clients` | `object[]` | Who is connected: `{ id, address, seconds }` |
| `received` | `number` | Messages from clients handed on into the pipeline |
| `published` | `number` | Messages the pipeline published |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Anything; `{ topic, payload, qos?, retain? }` — or any input, with `topic` set — is published to the clients |
| **Output** | The input, unchanged. Per message a client publishes under `topics`: `{ topic, payload, qos, retain, clientId }` |

---

## Typical uses

The house's devices report to the board, which keeps what they say:

```
MQTT Broker (port 1883) → Map → SQL
```

A board as the hub between its own parts and whatever else connects:

```
MQTT (publish) → Stopper → MQTT Broker → MQTT (subscribe) → Monitor
```

A reading from elsewhere, announced to every connected device:

```
HTTP Client → Map ({ topic: "weather/now", payload: … }) → MQTT Broker
```
