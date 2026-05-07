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

The service maintains a persistent connection. If an error occurs, it retries after a 10-second back-off.

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
| `connect` | `boolean` | — | Send `{ connect: true }` to start the connection |
| `disconnect` | `boolean` | — | Send `{ disconnect: true }` to stop the connection |

### Read-only state fields

| Field | Type | Description |
|---|---|---|
| `running` | `boolean` | Whether the IDLE loop is active |
| `error` | `string` | Last error message, if any |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — passed through unchanged when the pipeline is triggered externally |
| **Output (push)** | `{ subject, from, to, date, messageId, seqno }` — emitted for each new email |

### Output object fields

| Field | Description |
|---|---|
| `subject` | Email subject line |
| `from` | Sender address(es), comma-separated |
| `to` | Recipient address(es), comma-separated |
| `date` | ISO 8601 arrival date string |
| `messageId` | MIME Message-ID header value |
| `seqno` | IMAP sequence number of the message |

---

## Typical uses

- IMAP Email → Monitor — log every incoming email to the console
- IMAP Email → Map → HTTP Uploader — forward email metadata to a webhook
- IMAP Email → Filter → Notification — alert on emails matching a subject pattern
