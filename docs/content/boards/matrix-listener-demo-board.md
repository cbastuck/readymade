# Matrix Chat

A chat view onto one Matrix room, running in the Readymade app.

## What it does

Pick a room, and the board shows what's said in it as it's said, with a
composer underneath to answer. It's the same room you see in Element or any
other Matrix client, so the people there see your messages as usual.

## How it works

Everything runs in the app's embedded runtime, hkp-rt, so the phone or
desktop talks to the homeserver directly, with no server of ours in between.

- **Message** is an Injector: the composer drops what you type into it.
- **Matrix Sender** posts it to the room.
- **Matrix Listener** keeps a sync open with the homeserver and passes on
  every new message. The chat reads them from its notifications, so your own
  messages show up once, as you send them.

The listener comes last in the pipeline so that what you send doesn't flow
into it: a message reaches the listener only by coming back from the room.

## Try it

1. Open the board in the Readymade app and go to **Setup**.
2. Set your homeserver (it starts as `https://matrix.org`).
3. Paste your access token. In Element it's under **Settings → Help & About →
   Access token**. It goes into the app's vault; the board only names it.
4. Name the room by its alias (`#room:matrix.org`) or id. Your account needs to
   be in it already.
5. Tap **Connect**, then switch to **Chat**.

The room has to be unencrypted. Element encrypts direct messages and private
rooms by default, so start with a public room or one created without
encryption; an encrypted room shows up as a notice instead of messages.
