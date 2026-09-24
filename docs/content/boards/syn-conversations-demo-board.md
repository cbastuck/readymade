# SYN Conversations

Booking enquiries arriving as mail, filed into conversations, read by a model
into structured fields, and answered — with every outgoing message waiting for a
person to approve it. The [SYN](./syn-board.md) booking half, as a board you can
drive by hand.

## What it does

Mail comes in and is filed by its headers into a conversation. A model reads it
into fields. When something required is missing, a second model turn drafts the
email asking for it — and that draft goes nowhere until somebody approves it.

Everything lives in the board's own SQLite database at `~/.hkp/node/db`, so it
survives a restart.

## The conversation states

```
init → needs-follow-up   (something required is missing)
     → ready             (nothing is)
     → waiting-approval → waiting-reply → done
```

## How it works

Six [REST runtimes](../concepts/runtime.md#the-servers) on one hkp-node, each a
short chain ending in a [Stopper](../services/stopper.md). They are separate
because they run at different times and for different reasons, not because the
work is long.

**0 · test** — an [Injector](../services/injector.md) holding a German test
enquiry, a [Map](../services/map.md), and
[Conversations](../services/conversations.md) in `ingest` mode. This is how you
drive the loop without a mailbox.

**1 · intake** — [IMAP Email](../services/imap-email.md) and
[Conversations](../services/conversations.md). Filing, and nothing else.

**2 · dispatch** — a [Timer](../services/timer.md),
[Conversations](../services/conversations.md) in `actionable` mode, and an
[Iterator](../services/iterator.md) running one pipeline per conversation that
wants attention.

**3 · review** — a timer and three
[Conversations](../services/conversations.md) reads, gathering what is waiting.

**4 · approve** and **5 · reject** — [Iterators](../services/iterator.md) acting
on what a person decided.

## Artifact status says what is waiting on whom

An **extraction** is `recorded` — it is data, and nobody has to look at it.
A **follow-up draft** is `pending` — it does not go anywhere until somebody
approves it. The status is not decoration; it is the difference between
something the system did and something it wants permission to do.

## The facade

Three panels: **Conversations**, **What was understood** (the extractions), and
**Follow-up emails** (the drafts awaiting approval). Buttons drive the loop by
hand — *File demo enquiry*, then *1 · Extract*, then *2 · Draft follow-up* — or
you can type your own text into the field beside them.

## Try it

Needs hkp-node on port 8080.

Extraction and drafting run against Hetzner's inference API using the
`{{secret.hetzner.token}}` alias from **Settings → Secrets**. For a local model
instead, set both [text-generation](../services/text-generation.md) services'
URL to `http://127.0.0.1:8081`, clear their key, and run:

```
./build/bin/llama-server -m ~/…/models/Qwen3-0.6B-Q8_0.gguf --port 8081
```

[The Anthropic variant](./syn-conversations-anthropic-demo-board.md) is the same
board against the Claude API.

For real mail, set `host`, `username` and the `{{secret.gmail.imap}}` password
on the Mailbox service in runtime 1 and start it. IMAP IDLE pushes new mail in,
and a message already filed is ignored — so re-delivery costs nothing.
