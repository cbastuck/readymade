# Offer Intake — Follow-up

Where [Offer Intake](./offer-intake-demo-board.md) stops at extraction, this one
goes a step further: email arrives, is read once by the model, and either
becomes a complete booking request or a drafted reply asking for what is
missing. Nothing is sent.

## What it does

It reads each enquiry, works out whether anything required is absent, and when
something is, drafts the email that would ask for it. Every draft waits in the
panel for a person.

## How it works

Two [REST runtimes](../concepts/runtime.md#the-servers) on one hkp-node.

### intake

A single chain, and the service names read as the sentence the board performs:

**Mailbox** ([IMAP Email](../services/imap-email.md)) → **As Prompt**
([Map](../services/map.md)) → **Read The Enquiry**
([Text Generation](../services/text-generation.md)) → **Check What Is Missing**
→ **Every Enquiry Read** → **Complete? Then Nothing To Ask** → **Draft Awaiting
Review** → **Drafted — Nothing Is Sent**.

**Complete? Then Nothing To Ask** is the branch. A complete request needs no
follow-up, so the chain [stops](../concepts/runtime.md#control-flow) there. An
incomplete one continues into drafting.

### review

**Panel Refresh** on a [Timer](../services/timer.md), **Drafts** reading what is
waiting, and **The Panel Reads This**.

## Read once, not twice

The model runs **once** per enquiry. Extraction and the missing-field check are
the same turn, not two — which halves the cost and removes the possibility of
the two disagreeing about what the message said.

## The last service is named after what it does not do

**Drafted — Nothing Is Sent**. Every board in this family ends a phase with a
service whose name states the guarantee, and this is the strongest one: the
board writes replies and never delivers them. Sending is a person's action, and
the pipeline has no service that could perform it.

## Try it

Needs hkp-node on port 8080, with `{{secret.gmail.imap}}` and
`{{secret.hetzner.token}}` in **Settings → Secrets**.
