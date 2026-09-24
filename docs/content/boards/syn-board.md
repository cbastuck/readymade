# SYN

A hotel booking desk that reads its own mail. Two halves — one that talks to
guests, one that finds hotels — written as separate boards and linked into one.
The most substantial board here, and the reference example for
[units](../concepts/units.md).

## What it does

Booking enquiries arrive by email. SYN files each one into a conversation, reads
it into structured fields with a model, asks the guest for anything missing, and
once the request is complete, publishes it for the other half to act on. That
half finds matching hotels and records what it found. Nothing is sent to anybody
without a person approving it first.

## How it is put together

SYN declares **no runtimes of its own**. It is a composition: a list of two
units and the bindings that point them at a server.

```json
"units": [
  { "uri": "syn-booking-unit-board.json", "as": "booking" },
  { "uri": "syn-hotels-unit-board.json", "as": "hotels",
    "params": { "requestsTopic": "booking.ready" } }
]
```

Each unit is an ordinary board that still runs on its own. Open *SYN Booking*
alone and it works, warning that nothing exports the topic it imports — which is
exactly what running alone means. Loaded together they satisfy each other, and
from then on an unexported import is an *error*, because listing a unit asserts
the set is complete.

Linking qualifies exactly one thing: the runtime id. Booking's `intake` becomes
`booking.intake`, hotels' becomes `hotels.intake`, and the service uuids inside
them are untouched — both units contain a service called `after-intake`, and in
different runtimes that has always been legal.

A `uri` says where a document is, not what it is called. It resolves relative to
wherever the composition itself was loaded from: a sibling file on disk, a
document beside a share link, or a saved board of the same base name.

## The booking unit

Three [REST runtimes](../concepts/runtime.md#the-servers) on one hkp-node, in
chain order.

**0 · Test without mail** — an [Injector](../services/injector.md), a
[Map](../services/map.md) and a [Conversations](../services/conversations.md) in
`ingest` mode, so the whole pipeline can be exercised without a mailbox. It ends
in a [Stopper](../services/stopper.md).

**1 · Mail in** — [IMAP Email](../services/imap-email.md) polls the inbox and
[Conversations](../services/conversations.md) files each message by its headers
into the `syn-booking` database. Filing is all this runtime does.

**2 · Decide & act** — a [Timer](../services/timer.md) every ten seconds,
[Conversations](../services/conversations.md) in `actionable` mode to find
threads that want attention, and an [Iterator](../services/iterator.md) running
one pipeline per conversation. Inside, three
[Joins](../services/join.md) gather context — the thread, what is already known,
what has been approved — and hand it to a
[Communication Dispatcher](../services/communication-dispatcher.md) with a
stated goal.

The dispatcher's branches are the interesting part. `decide` asks
[Text Generation](../services/text-generation.md) what to do next; `extract`
reads the enquiry into fields and stores the result as an artifact; `follow-up`
drafts a reply and stores it as *pending*; `send` delivers one a person has
approved.

When everything required is known, the manager's `request-quotes` action
publishes the completed request to the topic `booking.ready` and moves the
conversation to *quotes-requested*.

## The hotels unit

It knows nothing about mail, conversations or guests. It takes completed
requests off `booking.ready`, finds hotels that match, and records them. The
hotel directory is a mock seeded by the Find service's own schema — a real one
would be an [HTTP client](../services/http.md) against a supplier API, and
nothing else would change.

## Two decisions worth borrowing

**The publish sits before the transition.** A failed publish stops the action,
so the dispatcher never advances the conversation, and the next tick tries
again. That ordering is what makes an outbox unnecessary.

**The ack sits last**, after candidates are recorded. A crash before it leaves
the claim to expire and the request to be handed out again. Handling the same
request twice is a nuisance; losing one is a lost booking.

## Try it

Both units run against an hkp-node at `127.0.0.1:8080` and share its queue —
messages live with the runtime that took them in. Each names its own database,
`syn-booking` and `syn-hotels`, so their tables stay apart.

Extraction, drafting and the manager's decision run against the Claude API on
`claude-haiku-4-5` using the `{{secret.anthropic.key}}` alias from
**Settings → Secrets**. The key must be scoped to a workspace, or the API asks
for a workspace id this service has no field for.

To move a unit to a different server, give its runtime a `url` in the
composition's bindings — without editing the unit.
