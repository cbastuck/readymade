# Telegram Listener

Listens for incoming Telegram messages via a bot and pushes each text message into the pipeline.

---

## Available in

| Runtime | Service ID |
|---|---|
| hkp-node | `telegram-listener` |

---

## What it does

The Telegram Listener service connects to the Telegram Bot API using long polling (`getUpdates` with a 25-second timeout). Each incoming text message is parsed and emitted downstream as a structured object — making it a **source service** that drives the pipeline without an upstream trigger.

Pending updates accumulated while the bot was offline are drained silently on connect, so only messages sent after the connection is established are forwarded.

Optionally restrict reception to a single chat by setting `allowedChatId` to your personal Telegram chat ID — useful when you share the bot with no one else but still want to prevent accidental input.

---

## Setup

1. Open Telegram and message **@BotFather** → `/newbot` → follow the prompts.
2. Copy the bot token BotFather gives you into the **Bot Token** field.
3. To find your chat ID: message the bot once, then call `https://api.telegram.org/bot<TOKEN>/getUpdates` — your numeric ID appears in `result[].message.chat.id`.
4. Paste that ID into **Allowed Chat ID** to restrict the service to your messages only.
5. Click **Connect**.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `botToken` | `string` | `""` | Telegram Bot API token from @BotFather |
| `allowedChatId` | `string` | `""` | If set, only messages from this chat ID are forwarded |
| `connect` | `boolean` | — | Send `{ connect: true }` to start polling |
| `disconnect` | `boolean` | — | Send `{ disconnect: true }` to stop polling |

### Read-only state fields

| Field | Type | Description |
|---|---|---|
| `running` | `boolean` | Whether the polling loop is active |
| `error` | `string` | Last error message, if any |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — passed through unchanged when the pipeline is triggered externally |
| **Output (push)** | `{ text, from, chatId, messageId, date }` — emitted for each incoming text message |

### Output object fields

| Field | Description |
|---|---|
| `text` | The message text |
| `from` | Sender's `@username` or first name |
| `chatId` | Telegram chat ID as a string |
| `messageId` | Telegram message ID |
| `date` | ISO 8601 timestamp of the message |

---

## Typical uses

- Telegram Listener → Monitor — display every message you send from your phone
- Telegram Listener → Map → HTTP Client — forward messages to a webhook
- Telegram Listener → Filter → Timer — trigger a pipeline only on specific commands
