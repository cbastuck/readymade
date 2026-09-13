# Mounts

How a service that must be reachable from outside the board gets an address, and how another service points at it without knowing that address in advance.

---

## The problem

Most services only talk to the service next to them in the pipeline. A few have
to be reachable by something that is not part of the board at all: a webhook
posted by someone else's product, a phone scanning a QR code, a PeerJS client
looking for its signalling server, or a service on another runtime — possibly on
another machine — calling in.

Those services need an address, and originally each one bound a port it chose.
That broke in three separate ways:

- **Ports are a single machine-wide namespace.** With several tenants sharing one
  hkp-node, a service asking for port 8081 is a land grab: the second claimant
  fails to start, and whoever wins receives traffic the other one expected.
- **Runtime ids are only unique per tenant.** Boards ship stable ids like `node`
  or `chat-node`, and hkp-node namespaces runtimes by the authenticated user, so
  two people can load the same board without colliding. Such an id cannot appear
  in a publicly routable path.
- **These endpoints are deliberately unauthenticated.** They exist to be called
  by outside parties who hold no token, so something other than a credential has
  to gate access.

---

## What a mount is

A **mount** is an endpoint that a service's *runtime* assigns to it, rather than
one the service claims for itself. The runtime serves it on its own server under
an opaque path:

```
http://<host>:<port>/hosted/<mountId>
```

and publishes the resulting address in the service's own state, in the reserved
field `__hkpMount`. The service never learns a port; it asks its host for a
mount and gets back a URL.

Because the endpoint is unauthenticated by design, **the unguessable id is the
capability**: knowing the address is what it takes to reach it, and the address
carries no user identifier that a public URL would otherwise leak.

---

## Why the id is derived, not drawn

The id is an HMAC of everything that identifies the mount — the owner, the
board, the runtime, and what the mount is called (`mountName`, defaulting to the
service's uuid) — keyed by a secret only the server holds (`HKP_MOUNT_SECRET`,
otherwise persisted per runtime at `~/.hkp/node/mount-secret` or
`~/.hkp/python/mount-secret`).

Random ids were the first implementation. They were just as unguessable, but the
address changed every time a board loaded — so a webhook configured by hand in
somebody else's product broke on every restart, and a board could not be
redeployed without reconfiguring its callers.

Deriving the id keeps the address stable across reloads, restarts and redeploys
while keeping the secret out of the board. The board says only what the mount is
*called*, which is not sensitive. Renaming one mount rotates that one address;
rotating the server's secret rotates all of them.

---

## What each runtime actually does

"Mount" is the board-wide vocabulary, but the mechanism behind it differs, and
only node and python assign paths:

| Runtime | How a hosted service becomes reachable | Published address |
|---|---|---|
| hkp-node | mount path on the runtime's shared server | `http://host:port/hosted/<mountId>` |
| hkp-python | same | `http://host:port/hosted/<mountId>` |
| hkp-rt | binds a port of its own | `http://<lan-ip>:<port>/` |
| Browser | hosts nothing; it consumes mounts | — |

Services that own a mount today: `http-server-subservices` (node, python,
hkp-rt) and `peer-server` (node).

On hkp-rt the port is part of the board and is restored on load. A board that
says `"port": 0` asks the operating system for any free port; whatever it got is
what the service then reports, so saving the board records a concrete port and
the next load binds that same one.

---

## Pointing at a mount

Since the address is assigned when the board loads, a board cannot hard-code it.
So a board names the **service** instead, and the address is resolved at connect
time.

Two things, with one job each:

| | Written by | Holds |
|---|---|---|
| the service's own target field (`url`, `peerHost`, …) | a person | a `hkp-mount://<runtimeId>/<serviceUuid>` reference, or a plain address |
| `__hkpMount` | machinery | the address a mount currently has — published by the owner, written onto a consumer by the coordinator |

```json
{
  "serviceId": "http-client",
  "state": {
    "url": "hkp-mount://endpoint-node/echo-server",
    "path": "/hello"
  }
}
```

A consumer prefers `__hkpMount` when it holds an address and falls back to its
own field; a reference in *either* means "not resolved yet" rather than
something to dial. Because the two live in separate fields, resolution never
overwrites what was written — so a board saves and reopens with its reference
intact.

References are found by their **scheme**, wherever they appear in a service's
state, rather than by living in one agreed field. That is what lets a reference
go in whatever field a service already calls its target, and it is safe because
a `hkp-mount://` value cannot be mistaken for anything else — the same reason
`{{secret.…}}` is resolved wherever it occurs. A bare
`<runtimeId>/<serviceUuid>` would *not* be safe: it is indistinguishable from a
relative URL, and the hosts these boards run on resolve those against a base
that differs between builds (`hkp://` packaged, `http://` in dev). It is
deliberately not a path under the existing `hkp://` scheme either — that one
addresses servable resources, and a reference is not one.

Boards written before the split put the reference in `__hkpMount` itself. Those
keep working: it is a string in service state like any other, and it is found
the same way.

---

## Who resolves a reference

Resolving one needs a view of the **whole board** — a runtime sees only its own
services, while a reference names a service somewhere else, possibly on another
machine. That view belongs to the board's **coordinator**, the instance that
owns the board: the browser for a playground or Readymade board, hkp-node for a
cloud board.

Two paths, depending on where the consumer lives:

- **A service the browser hosts** asks the coordinator whenever it needs the
  address (`coordinator.resolveMount`), and retries. Peer Socket does this at
  connect time.
- **A service on a remote runtime** cannot ask, so the coordinator pushes: as
  soon as an address exists, it configures the consumer with the plain address —
  the same value that service would have received had the board been exported.

An unresolved reference is **normal, not an error**. A board restores its
runtimes concurrently, so when a consumer is created its owner has usually not
published anything yet; a mount can also appear much later, when someone
unbypasses a server by hand. Consumers therefore wait rather than calling
something else.

---

## Exporting, forking, and the reserved prefix

- **Export** substitutes the resolved address into the same field. A board sent
  to another device is not the board that holds the referenced runtime — a
  partner board drops runtimes the partner cannot reach — so a reference sent as
  such would leave the receiver waiting forever. Because both forms live in one
  field, the receiving service reads it exactly as it always does and needs to
  know nothing about export. References that cannot be resolved are left
  untouched rather than blanked, so a board exported before its runtime came up
  still describes what it wanted.
- **Forking** a board regenerates every runtime id and service uuid, and rewrites
  the ids *inside* mount references along with them, so the copy points at the
  copy. An address rather than a reference is left alone: it may name something
  outside this board entirely.
- **The `__hkp` prefix** marks a state property whose meaning is defined outside
  the service holding it — generic board machinery reads and rewrites it. The
  name is reserved: services must not use it for anything else.

---

## Worked example

`mounted-endpoint-demo-board.json`: one hkp-node runtime hosts an endpoint, another
calls it, and no address appears anywhere in the board.

```json
{
  "services": {
    "endpoint-node": [
      {
        "uuid": "echo-server",
        "serviceId": "http-server-subservices",
        "state": { "bypass": false, "pipeline": [ … ] }
      }
    ],
    "caller-node": [
      {
        "uuid": "call",
        "serviceId": "http-client",
        "state": { "__hkpMount": "hkp-mount://endpoint-node/echo-server" }
      }
    ]
  }
}
```

On load, `echo-server` receives a mount and publishes its address into its own
`__hkpMount`. The coordinator sees both runtimes, matches the reference held by
`call`, and configures it with that address. The client starts calling.

---

## Known gaps

Current limitations, stated so a board author is not surprised by them:

- **References name ids, not names.** `hkp-mount://<runtimeId>/<serviceUuid>`
  only — a runtime's display name or a service's alias cannot be used, so
  hand-written boards carry uuids.
- **An unresolvable reference looks exactly like a slow one.** Both leave the
  consumer waiting, so a typo in a reference produces no error, just silence.
- **A board that still writes its reference into `__hkpMount` loses it on save.**
  Serialization asks each service for its live state, and the coordinator has by
  then written the resolved address into that field. Writing the reference in the
  service's own field instead (`url`) avoids this entirely — nothing overwrites
  it.
- **One mount per consumer.** The resolved address has one field to go in, so a
  service naming two mounts gets only the first resolved (and a warning). A
  service that needs two should host a pipeline instead.
- **"Mount" means two things.** An assigned path on node and python, a bound port
  on hkp-rt. Only the reference vocabulary is genuinely shared by all runtimes.

---

## Where it lives in the code

| Concern | File |
|---|---|
| Vocabulary: field, scheme, finding references | `hkp-frontend/src/runtime/board/mount.ts` (`parseMountRef`, `findMountRefs`) |
| Resolution (browser as coordinator) | `hkp-frontend/src/core/coordinator.ts` |
| Pushing addresses to remote consumers | `hkp-frontend/src/core/mountPublication.ts` |
| Rewriting references when forking | `hkp-frontend/src/core/forkBoard.ts` |
| Mount registry, id derivation | `hkp-node/src/mounts.ts`, `hkp-python/src/hkp/mounts.py` |
| Resolution (hkp-node as coordinator) | `hkp-node/src/coordinator/session.ts` |
| C++ vocabulary | `hkp-rt/lib/src/mount.h` |

---

See also: **Coordinator** (`concepts/coordinator.md`) for who resolves a
reference, **Runtime** (`concepts/runtime.md`) for the host that assigns a
mount, and **Units and compositions** (`concepts/units.md`) for what happens to
a reference when a unit's runtime is renamed.
