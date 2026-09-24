# Send ntfy

Takes a topic and a message, posts the message as a push notification, and
answers with a confirmation somebody could read aloud. A skill target for the
voice assistant boards.

## What it does

Given `{ topic, message }`, it POSTs to `https://ntfy.sh/<topic>` and returns
`{ text: "Notification sent to topic …" }`.

## How it works

One [browser runtime](../concepts/runtime.md), four services.

1. **Build Request**, a [Map](../services/map.md) in `replace` mode, turns the
   incoming `{ topic, message }` into a URL and a body.
2. **POST ntfy**, a [Fetcher](../services/fetcher.md), sends it.
3. **Build Confirmation**, a [Map](../services/map.md), phrases the result as a
   sentence.
4. **Confirmation**, a [Monitor](../services/monitor.md), reports it.

## Why it answers in words

A skill that sent the notification and returned nothing would leave the calling
assistant with nothing to say. Returning a sentence is the contract every skill
target on these pages follows: the caller's
[text-to-speech](../services/text-to-speech.md) reads whatever comes back, so
the skill decides how its own success is announced.

It is dispatched by name through [Skill Router](../services/skill-router.md) via
a [Board Service](../services/board-service.md) in *board name from input* mode.
Save it locally as `send ntfy`.
