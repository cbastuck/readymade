# SYN Conversations (Anthropic)

[SYN Conversations](./syn-conversations-demo-board.md) with both model turns
pointed at the Claude API instead of Hetzner's inference endpoint. The board is
otherwise identical, down to the runtime ids.

## What differs

Only the two [text-generation](../services/text-generation.md) services:

| | Hetzner variant | This board |
|---|---|---|
| `backend` | `server` | `anthropic` |
| `model` | `Qwen3.8-27B` | `claude-haiku-4-5` |
| `serverUrl` | `https://inference.hetzner.com/api/v1` | — |
| `apiKey` | `{{secret.hetzner.token}}` | `{{secret.anthropic.key}}` |

Both run at `temperature 0.3`, because extraction and drafting want
consistency rather than variety.

## Why it is a separate board

Anthropic is a distinct backend on the same service rather than a different
service — the pipeline, the prompts, the artifact statuses and the approval gate
are all unchanged. Shipping it as its own board makes the comparison concrete:
two documents, differing in four fields, doing the same work through different
providers.

The `{{secret.…}}` alias is what makes that possible without either board
carrying a credential. See [Board JSON](../board-json.md) for what a board
deliberately does not contain.

## How it works

See [SYN Conversations](./syn-conversations-demo-board.md) — six runtimes, mail
filed into conversations, a model reading enquiries into fields, a second turn
drafting follow-ups, and nothing sent without approval.

## Try it

Needs hkp-node on port 8080 and the `{{secret.anthropic.key}}` alias in
**Settings → Secrets**. The key must be scoped to a workspace, or the API asks
for a workspace id this service has no field for.
