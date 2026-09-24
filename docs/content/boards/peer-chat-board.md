# Peer Chat

Two people, two browsers, no server in between. Four services and a public
signalling host are enough for a working chat.

## What it does

Type a message; it appears in the other person's window. Both sides run the same
board, each naming itself and the other.

## How it works

One [browser runtime](../concepts/runtime.md).

1. **Message**, an [Injector](../services/injector.md) in plain-text mode, is
   the composer.
2. [Peer Socket](../services/peer-socket.md) in *Receive and Send* does the
   rest. It registers under a `peerName`, dials `targetPeer`, and pushes
   anything that arrives downstream on its own — independently of anything you
   type.
3. **Incoming Messages**, a [Monitor](../services/monitor.md), keeps the thread.
4. [Stopper](../services/stopper.md) ends the chain.

## Why the stopper is there

Peer Socket both sends what it receives from upstream and injects what arrives
from the network. Without a stopper the injected message would continue past the
monitor and, in a longer board, be treated as a fresh trigger. Ending the chain
explicitly says *this value has arrived, not departed*.

## Signalling, and what "no server" means

WebRTC still needs a rendezvous to introduce two browsers — here
`peerjs.hookitapp.com`. Once the connection is up, messages go directly between
the two peers and the signalling host sees none of them.

If you would rather not depend on a public host,
[Peer Chat over Node](./peer-chat-node-board.md) is the same board with the
signalling server moved onto a runtime of your own.

## The facade

Two lines of text showing the local and remote peer names, a button, and a
[message list](../concepts/board.md#the-facade) with a composer.

## Try it

Open it in two browsers. Swap `peerName` and `targetPeer` between them so each
names itself and the other.
