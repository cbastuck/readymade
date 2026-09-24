# Mounted Endpoint (hkp-rt)

Two runtimes on the same C++ server, one hosting an HTTP endpoint and the other
calling it — without either one knowing the address in advance. This is what a
[mount](../concepts/mounts.md) is for.

## What it does

Every five seconds the caller requests `/hello` from an endpoint hosted by the
other runtime, and the reply appears in a monitor.

## How it works

Two [REST runtimes](../concepts/runtime.md#the-servers), both on an hkp-rt
server reached as the `meander-cpp` remote.

### Endpoint

1. **Echo Endpoint**, an `http-server-subservices` in `process_on_session` mode,
   binds no port. Its runtime gives it a path on the server's own listener and
   publishes the resulting address in its state as `__hkpMount`. Its nested
   pipeline — a single [Map](../services/map.md) — is what answers the caller.
2. **End Of Chain**, a [Stopper](../services/stopper.md). The nested pipeline
   already answered the HTTP request; letting the value continue down the outer
   chain would be a second, meaningless run.

### Caller

1. **Every 5 seconds**, a [Timer](../services/timer.md).
2. **Call The Endpoint**, an [HTTP client](../services/http.md), whose `url` is
   `hkp-mount://endpoint-node/echo-server` — a *reference to the service*, not
   an address.
3. **Response**, a [Monitor](../services/monitor.md).

## The point

The endpoint's address is assigned when the board loads, so it cannot be written
into the board. Rather than hard-coding one, the caller names the service that
owns it, and the board's [coordinator](../concepts/coordinator.md) resolves that
reference into a real address — handing it over in a separate field so the board
still says what it *meant* when you save it again.

Runtime ids are namespaced per user, so `endpoint-node` here never collides with
somebody else's runtime of the same name on the same server.

## Try it

It needs an hkp-rt runtime reachable as the `meander-cpp` remote. The browser
variant of the same idea is `mounted-endpoint-demo-board.json`, on the
[Mounts](../concepts/mounts.md) page.
