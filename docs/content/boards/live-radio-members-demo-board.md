# Live Radio (Members)

[Live Radio (Cloud, direct)](./live-radio-cloud-direct-demo-board.md), made to
be deployed and shared. Your microphone is the station; the people you share
the board with are its listeners, and they are the only ones told where to
tune in.

## What it does

Deploy the board, add the people who should hear you, and send them the link
from *Copy link*. Each of them signs in, and is shown the player's address,
a QR code for a phone, and how many are listening. They open the player and
tap Listen; you press **Go on air**.

Once deployed, the board runs with nobody watching. The audio goes straight
from the app to the relay and on to every listener, never through the
coordinator or a window, so it keeps broadcasting for as long as the Readymade
app on your machine runs.

## How it works

Two [REST runtimes](../concepts/runtime.md), the same as in
[Live Radio (Cloud, direct)](./live-radio-cloud-direct-demo-board.md): hkp-rt
in the app, capturing, encoding and sending; hkp-node in the cloud, taking the
stream in over **Uplink** and passing it to every listener from **Relay**,
which also serves the player page from the board's
[assets](../concepts/assets.md). What is different is when each part runs and
who is shown what.

**The relay is up for as long as the board runs.** Uplink and Relay are not
bypassed, so the player's address exists from the moment the board is built
until it is stopped. Going on air switches only the microphone and the
writer. Off air, a listener's player stays connected and waits; stopping the
board takes the relay down with everything else, and a player that finds
nothing at its address says so instead of retrying.

**The player's address is a [mount](../concepts/mounts.md).** Like every
mount it is unguessable rather than guarded: whoever holds it can listen. Relay
names its mount `player` (`mountName`), so the address survives restarts and
redeploys, and changes only when that name does.

## Who is shown what

The facade has two panels. **Live Radio** is everybody's: the uplink's dot, the
number listening, the QR code, the player's address — a link, through
`"href": "{{value}}"` — and the stream's address for VLC. **Station** is kept
for the owner (`"visibleTo": "owner"`): the uplink's state and errors, and
**Go on air** / **Go off air**. So is the notice raising the microphone's
errors.

A member is [sent a projection](../concepts/cloud-boards.md#sharing-a-board-members),
and what is kept for the owner is left out of it before anything is read from
it. Of the board, a member is sent Relay's address, stream address and
listener count, and the writer's status — not the Station panel, not the
ingest endpoint, not the header carrying `radio-ingest`, and not the
microphone's errors. Going on air is a configure, which a member is refused
anyway; they are not offered it.

## Sharing it

1. Deploy the board to a coordinator from the Readymade desktop app (below).
2. Open it in Cloud Boards and choose **Members**: one entry per person, the
   address they sign in with and the name you know them by.
3. Send them the link from *Copy link*. It opens only for somebody on the list.
4. Press **Go on air**.

The address is the same for everybody, and nothing stops a member passing it
on. Removing somebody from the list closes their view of the board, but not
what they remember. To cut them off, move the address: give Relay's
`mountName` a new value in the playground and deploy again. Every listener is
disconnected, the old address answers nothing, and everybody still on the list
is shown the new one when they open the link.

## Try it

- **Deploy from the desktop app.** The Home runtime is the hkp-rt the app
  embeds (`"remote": "embedded"`). A phone's embedded runtime cannot join a
  coordinator, and the deploy preflight says so.
- **The Relay runs on the hkp-node you keep as the remote `node`**, and has to
  be reachable from wherever your listeners are: the player's address is on
  that server. If it sits behind a reverse proxy, the proxy has to pass
  WebSocket upgrades on `/hosted/`.
- **Give the secret `radio-ingest` a value** when asked; any long random string
  will do. It is handed to your two runtime servers, not to the coordinator,
  and they keep it in memory only — after either restarts, deploy again.
- The encoder's channels must match what the Microphone panel reports under
  Channels: 1 for a built-in mic, 2 for most interfaces.

Opened in the playground rather than deployed, it is the
[direct](./live-radio-cloud-direct-demo-board.md) board with its relay always
up: you are its owner, and see both panels.
