# Offer Intake (Hetzner)

[Offer Intake](./offer-intake-demo-board.md) with extraction running against
Hetzner's hosted inference API instead of a model on your own machine. Four
runtimes, same phases, same approval gate.

## What differs

One service, **Extract Offer**
([Text Generation](../services/text-generation.md)):

| | Local variant | This board |
|---|---|---|
| `serverUrl` | `http://127.0.0.1:8081` | `https://inference.hetzner.com/api/v1` |
| `model` | `qwen3-0.6b` | `Qwen3.8-27B` |
| `apiKey` | — | required |

## The key is write-only

The `apiKey` is configured on the panel and is **never saved back into the
board**. Boards are meant to be shared — as files, as links, as QR codes — and a
document that quietly accumulated the credentials of everyone who used it would
make that unsafe. The board records that a key *is configured*
(`apiKeyConfigured`), not what it is.

To see what the endpoint currently serves:

```
curl -s https://inference.hetzner.com/api/v1/models -H "Authorization: Bearer $TOKEN"
```

## How it works

See [Offer Intake](./offer-intake-demo-board.md): an **intake** runtime that
stores and stops, a **queue** runtime the panel reads, a **process** runtime
that runs only on approved items and acknowledges last, and a **requeue**
runtime for second looks.

## Try it

Needs hkp-node on port 8080 and a Hetzner inference token set on the Extract
Offer service.
