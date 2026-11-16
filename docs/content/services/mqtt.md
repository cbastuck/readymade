# MQTT

One connection to an MQTT broker: subscribes and pushes each message into the pipeline, or publishes what the pipeline hands it.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `mqtt` |
| Browser | `mqtt` |

The same service on both: one id, one configuration, one message shape, so a
connection moves between runtimes by moving the service. What differs is what
each can reach — see [In the browser](#in-the-browser).

---

## What it does

MQTT is how small devices talk: a sensor publishes a reading under a topic
(`home/kitchen/temperature`), a broker passes it to everybody subscribed to
that topic, and neither side knows the other. This service is one client of
such a broker, and it has two modes.

**`subscribe`** makes it a source. Every message published under one of its
`topics` becomes a pass through the services after it, and on to the next
runtime — nothing has to trigger it. A filter may use MQTT's wildcards: `+` for
one level (`home/+/temperature`), a trailing `#` for everything below
(`home/#`). An input arriving from the service before it passes through
untouched.

**`publish`** sends its input to the broker and passes it on once the broker
has taken it. The input is the payload, published under `topic`; an input
shaped `{ "topic": …, "payload": … }` names its own topic instead, and may say
`qos` and `retain`, which is how one service publishes under many topics.

A board that does both uses two of them, as the demo board does.

### Where the broker is

`url` says where and how:

| `url` | Transport |
|---|---|
| `mqtt://host:1883` | MQTT over TCP |
| `mqtts://host:8883` | MQTT over TLS |
| `ws://host/path`, `wss://host/path` | MQTT over WebSockets |
| `hkp-mount://<runtime>/<service>` | An [MQTT Broker](./mqtt-broker.md) on the same board |

A broker on the board is named by reference, because its address is assigned
when the board loads: the board fills it in (as `__hkpMount`), and the service
waits until it has. See [mounts](../concepts/mounts.md).

### Payloads

A received payload is read as JSON where it is JSON and as text otherwise —
`{"temperature":21.5}` arrives as an object, `ON` as a string. Set `format` to
`text` to keep `21.5` a string, or to `binary` for the bytes as they came.

A published payload is sent as it is when it is text or bytes, and as JSON
otherwise. Nothing at all (`null`) is an empty payload, which is how MQTT
clears a retained message.

### Staying connected

The service keeps the connection up by itself: one that goes away is taken up
again, retrying from 2 seconds up to a minute. Whether it should be connected
is part of its state, so a board saved or deployed while connected connects
again on load.

Subscriptions do not outlive the connection. A message published while the
service was away is not delivered late, unless the broker retained it.

A publish while there is no connection fails rather than waiting: nothing is
queued, and nothing is passed on to the services after it.

### Credentials

`password` is usually a secret reference —
`{{secret.broker}}` — resolved against the broker's host when the connection
is opened, and never kept in the board. MQTT carries a password only beside a
username, so set both.

### In the browser

A page opens WebSockets and nothing else, so in the browser runtime the broker
has to offer MQTT over WebSockets: `ws://`, `wss://`, or a broker on the board
named by reference. Given `mqtt://` or `mqtts://`, the service says that those
are a Node runtime's to reach instead of trying.

Three more things follow from running in the page:

- The connection lives only while the board is open. Something that should
  keep listening with nobody watching belongs on a Node runtime.
- A page served over `https` may open `wss://` only — `ws://` is refused,
  except to this device.
- A page is told that a connection failed and never why, so `error` cannot
  tell a wrong address from a refused login.

Mosquitto, EMQX, HiveMQ and most hosted brokers have a WebSocket listener, on
a port of its own; it is often off until switched on.

### On a hosted server

A server several people's boards run on (`HKP_EGRESS=public`) reaches no
broker on a private address — not `localhost`, not `192.168.…` — whichever
transport is used. See [where a hosted server may
connect](../concepts/runtime.md).

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | The broker: `mqtt://`, `mqtts://`, `ws://`, `wss://`, or a `hkp-mount://` reference. In the browser, `ws://`, `wss://` or a reference |
| `mode` | `string` | `"subscribe"` | `subscribe` or `publish` |
| `topics` | `string[]` | `[]` | Filters to subscribe to. Also accepted as one line, comma-separated |
| `topic` | `string` | `""` | What an input is published under when it names no topic itself |
| `qos` | `number` | `0` | `0`, `1` or `2` — for subscriptions, and for publishes that say nothing else |
| `retain` | `boolean` | `false` | Ask the broker to keep each published message for later subscribers |
| `format` | `string` | `"auto"` | How a received payload is read: `auto`, `text` or `binary` |
| `username` | `string` | `""` | Login name |
| `password` | `string` | `""` | Login password, usually `{{secret.<alias>}}` |
| `clientId` | `string` | `""` | The id presented to the broker. Empty draws a new one per connection |
| `enabled` | `boolean` | `false` | Whether to be connected; persisted, so a saved board reconnects on load |
| `connect` | `boolean` | — | Send `{ connect: true }` to connect, `{ connect: false }` to disconnect |

Changing the broker, the mode, the topics or the credentials while connected
reconnects with the new ones.

### Read-only state fields

| Field | Type | Description |
|---|---|---|
| `running` | `boolean` | Whether a connection is up right now |
| `status` | `string` | `disconnected`, `connecting`, `connected` or `reconnecting` |
| `reconnectAttempts` | `number` | Attempts since the connection was last up; `0` while connected |
| `error` | `string` | The last problem, if any |
| `received` | `number` | Messages pushed into the pipeline |
| `published` | `number` | Messages the broker has taken |

---

## Input / Output

| | Shape |
|---|---|
| **Input** (`subscribe`) | Anything; passed on unchanged |
| **Output** (`subscribe`) | Per received message: `{ topic, payload, qos, retain }` |
| **Input** (`publish`) | The payload, or `{ topic, payload, qos?, retain? }` |
| **Output** (`publish`) | The input, once published |

---

## Typical uses

Readings from the devices in a house, kept and charted:

```
MQTT (subscribe home/+/temperature) → Map → SQL
```

A switch on a board's facade turning a lamp on:

```
Button → Map ({ topic: "lamp/set", payload: "ON" }) → MQTT (publish)
```

A dashboard with no server of its own, reading a broker's WebSocket listener
from the page and charting it on the board's facade:

```
MQTT (browser, subscribe sensors/#) → Map
```

Only the readings that matter, sent on as a message:

```
MQTT (subscribe sensors/#) → Filter (payload.battery < 20) → Telegram Sender
```
