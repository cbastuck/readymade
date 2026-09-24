# Peer Chat over Node

The same chat as [Peer Chat](./peer-chat-board.md), with the signalling server
moved out of somebody else's cloud and onto a runtime you run. A good, small
example of a [mount](../concepts/mounts.md).

## What it does

Identical behaviour: messages typed in one browser appear in another. What
changes is who introduces the two peers.

## How it works

Two runtimes.

### Browser

1. **Message**, an [Injector](../services/injector.md).
2. [Peer Socket](../services/peer-socket.md) in *Receive and Send*. Instead of
   naming a public host it carries
   `hkp-mount://chat-node/chat-peer-server-svc` — a reference to the service on
   the other runtime, resolved to a real address when the board loads.
3. **Incoming Messages**, a [Monitor](../services/monitor.md).
4. [Stopper](../services/stopper.md).

### Node

1. **Peer Server** hosts the signalling endpoint. It binds no port of its own:
   its runtime gives it a path on the server it already has, and publishes the
   address as `__hkpMount`.
2. **Peer Events**, a [Monitor](../services/monitor.md), shows peers arriving
   and leaving, because `emitEvents` is on.

## Why this is the interesting version

The peer-to-peer part is unchanged — messages still travel directly between
browsers. What moved is the one piece that could not be peer-to-peer, and moving
it took no code: a service that hosts an endpoint, and a reference to that
service where an address would otherwise be.

Because the address is [derived rather than drawn](../concepts/mounts.md), it
survives restarts. A board saved today still points at the right place tomorrow.

## Try it

It needs an hkp-node runtime at `http://127.0.0.1:8080`. Open the board in two
browsers, both pointed at the same node.
