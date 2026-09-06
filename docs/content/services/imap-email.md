# IMAP Email

Listens on an IMAP mailbox and pushes each new incoming email as a structured object into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-node | `imap-email` |

---

## What it does

The IMAP Email service connects to any IMAP server and uses the IDLE command to receive server-push notifications when new mail arrives. Each new message is fetched, converted into an email envelope object, and emitted downstream — making it a **source service** that drives the pipeline without needing an upstream trigger.

The service keeps the connection up by itself. A connection that goes away — a socket
reset when a laptop lid closes, a server restart, a network that came back on a different
address — is reconnected automatically, retrying with an exponential back-off from 2 seconds
up to a minute until it succeeds. IDLE is renewed every five minutes so that a connection
which died without saying so is noticed rather than waited on.

Reconnecting resumes where the last connection left off: mail that arrived while the
connection was down is delivered on the next connection, and mail already delivered is not
delivered twice. Only the very first connection to a mailbox starts at its current end, so
existing mail is not replayed. If the server resets its UIDVALIDITY the mailbox is treated as
new again.

Whether the service should be listening is part of its state, so a board saved (or deployed)
while listening starts listening again on load — nobody has to be watching for it to come
back up.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | `""` | IMAP server hostname (e.g. `imap.gmail.com`) |
| `port` | `number` | `993` | IMAP server port |
| `username` | `string` | `""` | Login username / email address |
| `password` | `string` | `""` | Login password or app-specific password |
| `tls` | `boolean` | `true` | Use TLS (recommended — disable only for plain-text port 143) |
| `mailbox` | `string` | `"INBOX"` | Mailbox folder to watch |
| `enabled` | `boolean` | `false` | Whether to listen; persisted, so a saved board reconnects on load |
| `connect` | `boolean` | — | Send `{ connect: true }` to start, `{ connect: false }` to stop |
| `disconnect` | `boolean` | — | Send `{ disconnect: true }` to stop the connection |

### Read-only state fields

| Field | Type | Description |
|---|---|---|
| `running` | `boolean` | Whether a connection is up right now |
| `status` | `string` | `disconnected`, `connecting`, `connected` or `reconnecting` |
| `reconnectAttempts` | `number` | Attempts since the connection was last up; `0` while connected |
| `error` | `string` | Last error message, if any |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — passed through unchanged when the pipeline is triggered externally |
| **Output (push)** | `{ subject, from, to, date, messageId, references, inReplyTo, uid, text }` — emitted for each new email |

### Output object fields

| Field | Description |
|---|---|
| `subject` | Email subject line |
| `from` | Sender address(es), comma-separated |
| `to` | Recipient address(es), comma-separated |
| `date` | ISO 8601 arrival date string |
| `messageId` | Message-ID header, without its angle brackets |
| `references` | The References chain, oldest first — `references[0]` is the message that began the thread |
| `inReplyTo` | In-Reply-To header, or `""` when the message starts a thread |
| `uid` | IMAP UID of the message, stable within the mailbox |
| `text` | Plain-text body, empty when the message could not be parsed |

**Which conversation a message belongs to is stated by the sending client**, in
`references` and `inReplyTo`, and reading it there is much steadier than
recovering it from a subject: clients rewrite subjects, and the reply prefix
differs by language (`RE:`, `AW:`, `SV:`, `Antw:`). The root of the chain is the
identity every reply in a thread shares:

```
references[0] || inReplyTo || messageId
```

A message that starts a thread has neither header, so it is its own root.
Angle brackets are stripped everywhere, because they are header syntax rather
than part of the identity — left on, the same message compares unequal
depending on which header it was read from.

---

## Typical uses

- IMAP Email → Monitor — log every incoming email to the console
- IMAP Email → Map → HTTP Uploader — forward email metadata to a webhook
- IMAP Email → Filter → Notification — alert on emails matching a subject pattern
