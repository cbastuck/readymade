# SMTP Email

Sends mail. Addressed by its configuration, or by whatever the pass is carrying.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-node | `smtp-email` |

---

## Two ways of being addressed

The board says which, with `mode`.

**`configured`** is a fixed destination — an alert sink, a daily digest, one
address written down once. The input is the body and nothing else: a string is
sent as-is, anything else is JSON-serialised. The input is then passed on
unchanged, because this is a step in a pipeline that is about something else.

**`envelope`** is a reply. The recipient, subject and body all come from the
input, because they belong to whichever exchange this pass is about. What comes
out is the message that was sent.

Keeping that behind a mode, rather than letting the input win wherever it says
something, is deliberate. Everywhere else in HKP the input decides over the
configuration — `conversations` resolves a conversation id that way, `store` a
key. Mail is the exception: a `to` field drifting down a pipeline must not be
able to redirect a message that was addressed by configuration.

---

## Sending is awaited

In both modes. A send is not a notification that can be left to happen.

What follows it in a pipeline may file the message, mark a draft as sent, or
move a conversation on — and every one of those would be recording something
that had not happened yet, or had failed. **A failed send produces nothing**, so
the pipeline stops rather than continuing on that basis.

---

## Threading

`envelope` mode carries `inReplyTo` and `references` through to the message.
These are not decoration.

A reply that omits them starts a new thread in the recipient's client. Worse,
when they answer it, their `In-Reply-To` names a message that
[Conversations](./conversations.md) has never seen — so `threadOf` matches
nothing and **one exchange quietly becomes two conversations**, days later and
nowhere near the mistake that caused it.

The other half of that is filing what was sent. The message this service
answers with is already in the shape `conversations` ingests, so the two wire up
with nothing in between:

```
map (build the envelope) → smtp-email (envelope) → conversations (ingest, outbound)
```

Angle brackets are header syntax: they go on at the transport and come off in
the answer, so the same message compares equal wherever it was read from.

---

## Who it may write to

`allowedRecipients` is a list of addresses, or of domains written as
`@example.com`. An empty list allows everything, which is what a board that has
not thought about it gets.

Worth thinking about when the address is **data** — when it came out of a thread,
or the step that sends was chosen by a model. A person approving a draft is
approving the text; nobody approved the destination.

A message with several recipients is refused whole if any one of them is not
allowed.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"configured"` | `configured` or `envelope` |
| `host` | `string` | `""` | SMTP server hostname |
| `port` | `number` | `587` | SMTP server port |
| `username` | `string` | `""` | SMTP authentication username |
| `password` | `string` | `""` | Write-only: never echoed back. `passwordConfigured` says whether one is set |
| `tls` | `boolean` | `true` | Use TLS (`secure` in nodemailer) |
| `from` | `string` | `""` | Sender address; `envelope` mode may override it per message |
| `to` | `string` | `""` | Recipient — `configured` mode only |
| `subject` | `string` | `""` | Subject — `configured` mode only, and the fallback in `envelope` mode |
| `allowedRecipients` | `array` | `[]` | Addresses or `@domains` this may send to. Empty = unrestricted |

---

## Input / Output

**`configured`**

| | Shape |
|---|---|
| **Input** | any value — strings sent as-is, anything else JSON-serialised |
| **Output** | the same input, once it has been sent |

**`envelope`**

| | Shape |
|---|---|
| **Input** | `{ to, subject, body, from?, inReplyTo?, references? }` — `to` may be a list |
| **Output** | `{ messageId, from, to, subject, body, date, direction: "outbound", inReplyTo?, references? }` |

Either mode produces **nothing** when the send failed, or when it has not been
given enough to send with.

---

## Typical uses

- Timer → SMTP Email — periodic digest from a scheduled ping
- HTTP Server → SMTP Email → Monitor — an alert on every inbound request
- Conversations → Map → SMTP Email → Conversations — reply to a thread and file
  the reply back into it
