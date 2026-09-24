# Offer Intake

Enquiries arrive over a webhook and *wait*. A person approves the ones worth
processing; each approved one is read by a model, extracted into fields, and
written back. The approval gate is the whole design.

## What it does

Something POSTs an enquiry. It is stored and nothing else happens. Later, a
person looks at the queue and approves items one at a time; only then does the
model see them.

## How it works

Four [REST runtimes](../concepts/runtime.md#the-servers) on one hkp-node. Each
is a *phase*, and the names of their last services say so out loud.

**intake** — **Enquiry Webhook** receives the POST, then **Stored — Nothing Else
Runs** [stops](../services/stopper.md). Receiving and processing are separated
here deliberately: an enquiry that arrives at 3 a.m. should cost nothing but a
row.

**queue** — **Queue Refresh** on a [Timer](../services/timer.md), **Waiting**
reading the [Queue](../services/queue.md), and **The Panel Reads This** holding
the result for the facade.

**process** — the only runtime that does work. **Approved** takes the item,
**As Prompt** ([Map](../services/map.md)) shapes it,
**Extract Offer** ([Text Generation](../services/text-generation.md)) reads it
into fields, **Extracted** shows the result, **Acknowledge** confirms the queue
item, and **Done — Nothing Else Runs** stops.

**requeue** — **Return To Queue**, for an item that should be looked at again.

## The acknowledge comes last

**Acknowledge** runs *after* the extraction is recorded, not before. A crash in
between leaves the item unacknowledged, so it is handed out again — the same
enquiry processed twice is a nuisance, an enquiry silently lost is a customer.
The same ordering argument appears in [SYN](./syn-board.md), and it is worth
recognising as a pattern rather than a detail.

## Variants

| Board | Arrival | Model |
|---|---|---|
| This one | webhook | local llama-server |
| [Offer Intake (Hetzner)](./offer-intake-hetzner-demo-board.md) | webhook | Hetzner inference |
| [Offer Intake (IMAP)](./offer-intake-imap-demo-board.md) | email | local llama-server |
| [Offer Intake (IMAP + Hetzner)](./offer-intake-imap-hetzner-demo-board.md) | email | Hetzner inference |
| [Offer Intake — Follow-up](./offer-followup-demo-board.md) | email | Hetzner, and it replies |

## Try it

Needs hkp-node on port 8080 and a local model server:

```
./build/bin/llama-server -m ~/…/models/Qwen3-0.6B-Q8_0.gguf --port 8081
```
