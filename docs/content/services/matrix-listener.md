# Matrix Listener

Listens to Matrix rooms and pushes each message into the pipeline as it is said.

---

## Available in

| Runtime | Service ID        |
| ------- | ----------------- |
| hkp-rt  | `matrix-listener` |

---

## What it does

Matrix Listener signs in to a Matrix homeserver with an access token and keeps a
sync open — the Client-Server API's long poll, `GET /_matrix/client/v3/sync`.
Each new `m.room.message` in the rooms it listens to is pushed downstream as one
JSON object, so it is a **source service**: it drives the pipeline without
anything upstream.

It starts from the moment it connects. The first sync only finds out where
"now" is; what was said before that is not passed on. From then on it keeps its
position in `since`, which is saved with the board, so a board opened again
picks up what was said while it was closed.

Your own messages are left out unless `includeOwn` is on, so a board that
answers messages doesn't answer itself. An edit arrives as its new text, with
`replaces` naming the message it changes.

Since hkp-rt is the runtime the Readymade apps embed, this runs on the
desktop and on the phone. On a phone the operating system pauses the app when
it goes to the background, and the sync pauses with it; it picks up from
`since` when the app comes back.

### Encrypted rooms

This service doesn't do end-to-end encryption. Element encrypts direct
messages and private rooms by default; a room that sends encrypted events is
named in `warning` and its messages aren't passed on. Public rooms, and rooms
created without encryption, work.

### The access token

`accessToken` holds a `{{secret.<alias>}}` reference, and the token itself lives
in the vault. In Element you find it under **Settings → Help & About →
Access token**. The account has to have joined the rooms already.

---

## Configuration

| Property      | Type       | Default | Description                                                                                          |
| ------------- | ---------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `homeserver`  | `string`   | `""`    | The homeserver's address, e.g. `https://matrix.org`                                                  |
| `accessToken` | `string`   | `""`    | A `{{secret.<alias>}}` reference to the account's access token                                       |
| `rooms`       | `string[]` | `[]`    | Room ids (`!abc:matrix.org`) or aliases (`#room:matrix.org`) to listen to; empty means every joined room |
| `includeOwn`  | `boolean`  | `false` | Also pass on messages the account itself sent                                                        |
| `running`     | `boolean`  | `false` | `true` connects and keeps the sync open; `false` disconnects. Saved, so a board can connect on open  |
| `since`       | `string`   | `""`    | Where the sync is. Kept by the service; set it to `""` to start again from now                       |

Changing `homeserver` or `accessToken` clears `since`, because a position on one
account means nothing on another.

### Read-only state fields

| Field       | Type      | Description                                                  |
| ----------- | --------- | ------------------------------------------------------------ |
| `connected` | `boolean` | Whether the last sync succeeded                              |
| `userId`    | `string`  | The account the token belongs to, e.g. `@me:matrix.org`      |
| `error`     | `string`  | Why the last request failed; empty while connected           |
| `warning`   | `string`  | Rooms that are encrypted, or a saved position that was refused |

A refusal that waiting won't fix (an unknown token, a room alias that doesn't
exist) sets `running` to `false` and says why in `error`. A network problem is
retried, waiting longer each time, up to a minute between attempts.

---

## Bypass behaviour

Bypassed, the sync is closed and nothing is pushed. Turning bypass off
reconnects if `running` is on.

---

## Input / Output

|                   | Shape                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Input**         | Any value, passed through unchanged                                                            |
| **Output (push)** | `JSON` — `{ text, msgtype, sender, roomId, eventId, timestamp, date, content }`, one per message |

| Field       | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `text`      | The message text (the new text, for an edit)                      |
| `msgtype`   | `m.text`, `m.notice`, `m.emote`, …                                |
| `sender`    | The sender's Matrix id, e.g. `@alice:matrix.org`                  |
| `roomId`    | The room it was said in                                           |
| `eventId`   | The message's event id                                            |
| `timestamp` | When the homeserver received it, in milliseconds since the epoch  |
| `date`      | The same time, as an ISO 8601 date                                |
| `content`   | The event's whole `content`, for formatted bodies and the like    |
| `replaces`  | Only for an edit: the event id of the message it changes          |

Each message is also sent to the board as a notification, `{ received: <message> }`,
which is what a facade's `message-list` reads (`"path": "received.text"`).

---

## Typical uses

- Matrix Listener → Monitor: watch a room from the Readymade app
- Matrix Listener → Filter → Text Generation → [Matrix Sender](./matrix-sender.md): a bot that answers in the room it was asked in
- Matrix Listener → Map → HTTP Client: forward a room's messages to a webhook

The [Matrix Chat](../boards/matrix-listener-demo-board.md) board puts a listener and a
sender behind one chat view.
