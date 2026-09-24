# Offer Intake (IMAP + Hetzner)

Both substitutions at once: enquiries arrive by email, and extraction runs on
Hetzner's hosted inference API. Nothing runs on your machine except hkp-node
itself.

## What it is

The combination of [Offer Intake (IMAP)](./offer-intake-imap-demo-board.md) and
[Offer Intake (Hetzner)](./offer-intake-hetzner-demo-board.md):

- **intake** — [IMAP Email](../services/imap-email.md) → Store →
  [Stopper](../services/stopper.md)
- **queue** — [Timer](../services/timer.md) → Store → Stopper
- **process** — Store → [Map](../services/map.md) →
  [Text Generation](../services/text-generation.md) →
  [Monitor](../services/monitor.md) → Store → Stopper
- **requeue** — Store

Extraction uses `Qwen3.8-27B` at `https://inference.hetzner.com/api/v1` with the
`{{secret.hetzner.token}}` alias.

## Two things to know before you open it

**The board document has no `boardName`.** Every other board here names itself;
this one does not, so it is listed by its file name. Harmless, but it is why the
title above does not match a name inside the file.

**Its `description` is out of date.** The text stored in the board still
describes the local-model setup and tells you to start a llama-server on port
8081. The services say otherwise — `backend: server` pointed at Hetzner — and
the services are what runs. Where the two disagree, believe the
[anatomy and source](#anatomy) below, which are read from the document itself.

## Try it

Needs hkp-node on port 8080, mailbox credentials on the IMAP service, and
`{{secret.hetzner.token}}` in **Settings → Secrets**. You do **not** need a
local model server, whatever the stored description says.
