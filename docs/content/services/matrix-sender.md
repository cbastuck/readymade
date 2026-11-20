# Matrix Sender

Sends what reaches it to a Matrix room as a message.

---

## Available in

| Runtime | Service ID      |
| ------- | --------------- |
| hkp-rt  | `matrix-sender` |

---

## What it does

Matrix Sender posts each input to a room on a Matrix homeserver, as an
`m.room.message` (`PUT /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}`).
A string is the message. An object says what to send:

```json
{ "text": "Build **passed**", "html": "Build <b>passed</b>", "msgtype": "m.notice", "roomId": "!ops:matrix.org" }
```

Only `text` is needed (`body` works too, so a [Matrix Listener](./matrix-listener.md)'s
output can be sent on as it is). `roomId` sends to another room than the
configured one. Anything else, like a number or an object without `text`, is sent
as its JSON.

The room can be named by its id (`!abc:matrix.org`) or its alias
(`#room:matrix.org`); an alias is looked up once and remembered. The account has
to have joined the room.

Every message gets its own transaction id. When the homeserver asks the sender
to slow down, it waits (up to ten seconds) and tries once more with the same id,
which the homeserver treats as the same message, so a retry never posts twice.

### Encrypted rooms

This service doesn't do end-to-end encryption. A message sent to an
encrypted room still arrives, but unencrypted, and the clients there mark it
that way.

### The access token

`accessToken` holds a `{{secret.<alias>}}` reference, and the token itself lives
in the vault. In Element you find it under **Settings → Help & About →
Access token**.

---

## Configuration

| Property      | Type     | Default    | Description                                                         |
| ------------- | -------- | ---------- | ------------------------------------------------------------------- |
| `homeserver`  | `string` | `""`       | The homeserver's address, e.g. `https://matrix.org`                 |
| `accessToken` | `string` | `""`       | A `{{secret.<alias>}}` reference to the account's access token      |
| `roomId`      | `string` | `""`       | The room to send to: an id or an alias                              |
| `msgtype`     | `string` | `"m.text"` | `m.text`, `m.notice` (what bots usually send) or `m.emote`          |

### Read-only state fields

| Field         | Type     | Description                             |
| ------------- | -------- | --------------------------------------- |
| `lastEventId` | `string` | The event id of the last message sent   |
| `error`       | `string` | Why the last send failed; empty after a success |

---

## Bypass behaviour

Bypassed, nothing is sent and the input passes through unchanged.

---

## Input / Output

|            | Shape                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| **Input**  | `String`, or `JSON` `{ text, msgtype?, html?, roomId? }`; other JSON is sent as its text |
| **Output** | `JSON` — `{ roomId, eventId, text }` once the homeserver has the message; `Null` if it was not sent |

An empty input sends nothing and passes nothing on.

---

## Typical uses

- Timer → HTTP Client → Map → Matrix Sender: post a reading to a room every hour
- [Matrix Listener](./matrix-listener.md) → Filter → Text Generation → Matrix Sender: a bot that answers in the room
- Injector → Matrix Sender: a composer, as in the [Matrix Chat](../boards/matrix-listener-demo-board.md) board
