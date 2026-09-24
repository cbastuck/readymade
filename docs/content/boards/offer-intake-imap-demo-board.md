# Offer Intake (IMAP)

[Offer Intake](./offer-intake-demo-board.md) fed by a mailbox instead of a
webhook. Enquiries arrive as email, wait for approval, and are then extracted by
a local model.

## What differs

Only the **intake** runtime. Where the webhook variant opens an endpoint, this
one watches a mailbox:

**Mailbox** ([IMAP Email](../services/imap-email.md)) → **Dump** →
**Stored — Nothing Else Runs**.

## Why IMAP IDLE rather than polling

The mailbox is watched over **IMAP IDLE**, so new mail *pushes itself* into the
board. There is nothing to poll and — more to the point — **nothing to expose**.
The webhook variant needs an address the outside world can reach; this one
needs only an outbound connection to a mail server, which is a meaningfully
smaller thing to operate and secure.

A message already filed is ignored, so re-delivery costs nothing.

## The password is write-only

Set `host`, `username` and password on the Mailbox service. The password is
never saved back into the board — see
[Offer Intake (Hetzner)](./offer-intake-hetzner-demo-board.md#the-key-is-write-only)
for why that matters.

## How it works

The other three runtimes — **queue**, **process**, **requeue** — are unchanged
from [Offer Intake](./offer-intake-demo-board.md), including the acknowledge
that deliberately comes last.

## Try it

Needs hkp-node on port 8080, mailbox credentials, and a local model server:

```
./build/bin/llama-server -m ~/…/models/Qwen3-0.6B-Q8_0.gguf --port 8081
```

[The Hetzner variant](./offer-intake-imap-hetzner-demo-board.md) removes the
local server.
