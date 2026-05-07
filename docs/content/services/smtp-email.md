# SMTP Email

Sends incoming data as an email via SMTP, then passes the input through unchanged.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-node | `smtp-email` |

---

## What it does

On every value that arrives at the service, the input is serialised to a string (or used as-is if it is already a string) and sent as the plain-text body of an email to the configured recipient. The original input is then forwarded to the next service in the pipeline unchanged.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | `""` | SMTP server hostname |
| `port` | `number` | `587` | SMTP server port |
| `username` | `string` | `""` | SMTP authentication username |
| `password` | `string` | `""` | SMTP authentication password |
| `tls` | `boolean` | `true` | Use TLS (`secure` mode in nodemailer) |
| `from` | `string` | `""` | Sender email address |
| `to` | `string` | `""` | Recipient email address |
| `subject` | `string` | `""` | Email subject line |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — strings are sent as-is; objects are JSON-serialised |
| **Output** | Same as input (pass-through) |

---

## Typical uses

- Timer → SMTP Email — periodic digest emails from a scheduled ping
- IMAP Email → Map → SMTP Email — forward and reformat incoming emails
- HTTP Server → SMTP Email → Monitor — email alert on every inbound HTTP request
