# Coordinator connections: participants connect in, nothing is dialled

Status: concept only. Nothing here is built.

Two halves, coupled by what deploy checks before it hands a board over: **how a
board says which runtime server it wants** (a name, a requirement — which matters
even with no coordinator in sight, as soon as a board is shared), and **how a
board's participants connect to the coordinator that owns it**.

Companions: `CLOUD-BOARDS.md` (how deploy works today), `TODO-CLOUD-COORDINATOR.md`
(why the coordinator owns a deployed board), `TODO-SECRETS.md` (consent and
vaults, which this touches in three places), `TODO-CONSOLIDATION.md` (the
`hkp://remotes/<name>` fail-hard rule this follows).

---

## The problem

A board records **how to reach** a runtime — `"url": "http://127.0.0.1:8080"` —
and an address is only true from where the board is owned. Deploying changes the
owner, so a board that worked in the playground asks a machine in a datacentre to
dial its own loopback. The coordinator's SSRF guard refuses it:

```
Runtime "<id>": Runtime URL host "127.0.0.1" is not in HKP_RUNTIME_URL_ALLOWLIST
```

The guard is right, and the board is wrong to have written a fact about one
vantage point as though it were a fact about the runtime. But the deeper problem
is the assumption underneath both: that a coordinator reaches a runtime by
dialling an address a board handed it.

---

## Decided

### The coordinator never dials — it accepts

Every participant in a deployed board **connects to the coordinator**: runtime
servers on a laptop, runtime servers in a datacentre, and the browsers that open
the board. The coordinator makes no outbound connection on a board's say-so.

What follows from one rule:

- **No confused deputy.** Every bit of SSRF risk in `coordinator/urlGuard.ts` comes
  from the coordinator dialling an address out of an untrusted board. With nothing
  dialled there is no allowlist to maintain, no private-range policy, and no
  DNS-rebinding window left to close.
- **No reachability requirement.** A laptop behind NAT is not a special case, and
  neither is loopback. The only thing that must be reachable is the coordinator,
  which is what makes it one.
- **No address for the coordinator to hold.** It never needs a name-to-address
  table, so "this coordinator does not know that name" stops being an error class.

**One mechanism, not two.** An operator-run runtime server in the same datacentre
could have stayed dialable, and does not: it becomes a participant that happens to
be always connected. The uniformity is the point — see *required and transient*
below for why this is also the path browsers take, every time anyone opens a board.

### Relocating a runtime is not the answer — rejected 2026-09-22

The tempting fix for an unreachable runtime is for the coordinator to move it onto
a runtime server it *can* reach, matching by kind and service registry.

Rejected: a runtime is not only the services it runs. It sits on a machine with
files, models, devices, LAN neighbours and credentials, and the board records none
of that. A relocated runtime reproduces the board's structure while the resources
behind it stay where they were, and **nothing on either side can check that the
copy has the state which made the original correct**. It would deploy, report
success, and be wrong.

It is also the wrong thing to do with secrets: relocation moves credential *use*
onto a machine the person never approved, and trust-on-first-use
(`TODO-SECRETS.md` decision 3) would record that machine as legitimate on the way
past.

Moving a runtime to another machine is something a person does, by editing the
board.

### Who decides what — revised 2026-09-23

An earlier draft had each coordinator carry an operator-curated list of runtime
servers and refuse a board naming anything else. Dropped. It asked an operator to
enumerate every machine every user might run a runtime server on, and it guarded
the wrong thing: the danger was never *which* server a board named, it was the
coordinator dialling an address on a board's instruction. Accept-only removes the
danger, and with it the list's reason to exist.

The two consents that matter already exist, and they are independent:

| Question | Who answers | How, today |
| --- | --- | --- |
| May this person use this coordinator? | the operator | `ALLOWED_EMAILS`, per-tenant quotas (`hkp-node/src/index.ts`) |
| May this person run a runtime here? | each runtime server | it authenticates their JWT, as it always has |

So **the person decides which runtime servers their board uses**, and each runtime
server decides whether to accept them. A board pointed at a machine that accepts
the person is that person's data on a machine they chose — their own authority is
the ceiling, and there is no deputy to confuse.

### Deploy is an introduction

The browser is the only party that can reach both sides: it holds the person's
session with the coordinator *and* with each runtime server. So handing a board
over is an introduction, not a lookup.

1. The browser asks the coordinator for a **ticket** per participant, bound to
   `{sub, boardName, runtimeId}`.
2. It tells each runtime server: *connect to this coordinator, with this ticket* —
   over the same session it already uses to create runtimes there.
3. Each participant connects in, presents the ticket, and is bound to that runtime
   of that board.
4. It **persists the ticket** — beside the mount secret in `~/.hkp/` — and uses it
   to reconnect after a restart, with nobody present.

Pairing is therefore not a ceremony with its own configuration; it is what deploy
does. The ticket is the only thing that outlives the session, and revoking it is
the coordinator's to do.

A ticket is a bearer credential, and deliberately a narrow one: it speaks for one
runtime of one board of one person, it was issued by that person's own client to a
server that person chose, and it can be revoked. Its blast radius is the board it
belongs to.

### Provisioning survives; only the transport changes

The coordinator still builds and rebuilds a board's runtimes — over the connection
that came in, using the framing that already multiplexes a board's traffic for
attached browsers (`coordinator/bridgeProtocol.ts`). One provisioning model, one
direction of dialling, two situations.

This is what keeps a deployed board recoverable: when a runtime server restarts its
in-memory runtime is gone, and the coordinator rebuilds it from the board's config
as soon as that server reconnects — with no live user JWT, because the ticket
authenticates the machine.

It also preserves today's semantics: deploying **replaces**, it does not adopt. The
runtimes the browser built for itself (`garbageCollected: true`) are reaped when the
browser goes, exactly as now.

### Required and transient participants

A cloud board already contains a browser runtime (`views/cloud/index.tsx`), run by
whichever browser is attached, and browsers come and go constantly. That is normal
operation, not a failure, so "a participant is missing" cannot mean one thing:

- **Required** — the board cannot run without it. A missing required participant
  puts the board in `error`, naming it.
- **Transient** — expected to come and go. Data arriving for an absent transient
  participant **stops there**, exactly as a `Null` return stops propagation, and the
  board stays `running`.

Derive it from the runtime type rather than adding a field: a browser runtime is
transient, anything else is required. A flag can come later, when something needs to
disagree.

This is also the strongest argument for accept-only: browsers take the same path as
everything else, so the mechanism is exercised every time anyone opens a board. It
gets to be bulletproof by being used constantly rather than by being specified
carefully.

### A board still names a remote — the person's client resolves it

The board says **which remote**, never how to reach it. The word is the project's
already: *Remote — a runtime server the host knows by name*
(`docs/content/vocabulary.md`), addressed as `hkp://remotes/<name>`, listed in the
browser as `availableRuntimeEngines` (`BoardContext.tsx`). "Host" is not available;
this project uses it for the app shell.

Resolution happens **only on the person's side**, against the servers their client
keeps (`ManageConnectionsContent`, `RemotesController`), at the moment they deploy.
The coordinator resolves nothing: it knows participants by the tickets they present.
A name in a deployed board is a label for people, not an address for machines.

A runtime carries exactly **one** addressing mode, all of them authored:

- `url` — an address the person wrote. Every board that exists today.
- `remote` — a name, resolved by their client.
- `requires` — an object describing what will do:

```json
{
  "id": "py", "name": "Python", "type": "rest",
  "requires": { "kind": "python" }
}
```

**More than one is an error, not a preference.** No fallback, no precedence. A name
resolves differently for each person, so anyone who can put a board in front of you
controls whether its name resolves; if an unresolvable name fell back to a `url`,
they would get two attempts at making your client dial an address and need only the
second. Shared boards are untrusted input (`TODO-SECRETS.md`), and this is the cheap
half of taking that seriously.

**Resolution is never written back to the board.** The resolved address lives with
live runtime state, where mount addresses already live. That is what makes the rule
above enforceable: if resolution wrote into `url`, every resolved board would be in
the state the rule forbids.

**Backwards compatibility falls out rather than being arranged.** A board with `url`
and no `remote` is valid forever — today's boards, unmigrated, undeprecated.
`HKP_RUNTIME_HOST` substitution keeps working inside such a `url`.
`hkp://remotes/<name>` is a name in a url's clothing — Meander boards use it for the
embedded runtime and it already fails hard on unknown names — so read it as a legacy
spelling of `remote`: resolved as a name, not counted as an address.

**Export still bakes.** Sharing a single runtime as a QR already substitutes mount
addresses and template variables so the receiving device gets concrete values
(`RuntimeHeader.tsx`). A board exported that way has its name substituted into `url`
and `remote` dropped — still exactly one mode. Baking stays an explicit act of
export.

### Saying what a runtime needs: kind, registry, versions, tags

A requirement is **not** relocation. A board asking for "any python" is its author
declaring that this runtime is not bound to a particular machine; relocation was the
system deciding that for a board which had said otherwise. Same outcome, opposite
authority.

Four layers, cheapest and most automatic first:

1. **Kind** — `node | python | cpp | go`, authored. It must be authored even though
   the registry check is stricter: service ids are deliberately shared across
   runtimes (`text-generation` exists in python, node and cpp), so the registry says
   a server *has* the service but never which implementation was meant.
2. **Registry** — derived from the board's own services, authored by nobody. The
   strongest check available, and the one that replaces today's mid-provision
   `Unknown serviceId` 500 (`hkp-node/src/runtime.ts:932`).
3. **Service version and capabilities** — already on the wire: `ServiceRegistryEntry`
   is `{ serviceId, serviceName, version?, capabilities? }` (`hkp-node/src/types.ts`).
   A board pins these only where it depends on them.
4. **Remote tags** — labels for what is not a service property at all: this machine
   has a GPU, sits on a given LAN, holds a licence. Self-declared by the runtime
   server, the same answer for everyone.

**Version and tag are different matchers and must not share a syntax.** A
docker-style `python:v2.2` is an opaque string, so it stops matching the moment the
operator upgrades to v2.3 — which satisfies it. A **version** wants ordering ("at
least 2.2"); a **tag** wants set containment. Folded into one colon-separated string,
the version silently inherits exact-match semantics and every upgrade breaks boards.

**A tag describes a machine, not who may use it.** It decides where a board goes,
never what it may do: the runtime server goes on enforcing at the point of use. That
is what makes self-declaration safe — the worst a stale or dishonest tag can do is
send a board to a server that then refuses it.

**Deliberately not per user — decided 2026-09-23.** Tags could have varied by tier or
status. Rejected as ahead of demand and misleading about where the work is: a
tier-dependent answer only means anything if the server enforces it at the point of
use, so the honest version of that feature is enforcement across three runtime
servers, with the tag as its small visible part.

**Two rules for requirement matching:**

- **Ambiguity resolves by the client's own order, and the deploy dialog names the
  remote it chose.** Refusing when several candidates match would make a person with
  two python servers unable to run "any python" boards at all.
- **A requirement never selects a machine-bound remote.** A runtime that exists
  because of the machine it runs on is always addressed by name.

### Where kind and tags come from: the runtime server says

Most of it is already on the wire. `GET /runtimes` returns
`{ runtimes, registry, server: <kind> }` on all three runtime servers
(`hkp-node/src/server.ts`, `hkp-python/src/hkp/server.py`,
`hkp-rt/lib/src/http/server.cpp`). Kind is already self-declared, and so is the
registry — a build property, as that response's own comment says.

**Tags extend that response rather than getting a route of their own.** No new
surface, no second auth path, and the shape already exists in all three runtimes.
Read them when a candidate is being chosen, not when a server was first added: a
machine gains a GPU without anyone re-configuring anything.

### Preflight, and failing loudly

Placement is checked in the **browser**, before anything is handed over, and the
deploy dialog says per runtime which of these it is:

- resolved to a remote, which is running and accepted the person
- resolved, but the server is not running or refused them
- did not resolve on this client — naming the name
- resolved to a remote of the wrong kind, or one whose registry does not cover the
  board's services — listing what is missing

After handover, a **required** participant that never connects, or later drops, puts
the board in `error` **naming it**. `error` is not terminal: when the machine returns
it reconnects with its ticket and the coordinator rebuilds from config. What does not
come back is live runtime state.

**One connection per deployed board.** A ticket speaks for one board, so two boards on
one machine are two tickets and two connections. That keeps one board's traffic off
another's socket and keeps lifecycle and failure per board — the unit everything else
here uses.

---

## What this needs from secrets

Three points of contact with `TODO-SECRETS.md`:

1. **Consent stays keyed on the resolved destination, never the name.** Decision 4
   puts the URL in the grant key precisely because a runtime id is board-controlled
   and meaningless alone. A remote *name* is board-controlled in the same way and
   resolves differently per person, so it is strictly worse as a key. Consent is
   asked and recorded after resolution, in the client that resolved.
2. **A participant the coordinator did not dial needs an identity that is not an
   origin.** `releaseOrigin` has nothing to work with when nothing was dialled. The
   ticket's bound identity takes the origin's place — and is a better key, being
   something the machine holds rather than an address any board can point at.
3. **Which vault serves a participant on the person's own machine.** B-b chose that
   deploy carries only references and the person fills values into the
   **coordinator's** vault, where filling the form is the consent. A participant
   running on the person's own machine should resolve against that machine instead:
   pushing a cloud-held value down to a laptop is strictly worse than never sending
   it. The *needs configuration: `imap.password`* board state must then say **where**
   it is missing.

Stated plainly, because B-b states the opposite tradeoff and both are true: a
machine-bound participant also runs unattended, so it too must be able to decrypt with
nobody present. What changes is **who owns the box**.

---

## What this retires

- `coordinator/urlGuard.ts` — its entire job is validating addresses the coordinator
  is about to dial. Once nothing is dialled, the allowlist, the private-range policy
  and the noted DNS-rebinding window go with it.
- `HKP_RUNTIME_URL_ALLOWLIST` and `HKP_ALLOW_PRIVATE_RUNTIMES` as deployment concerns.
- The ordering trick in `handOverRuntimes()` wants re-examining: it exists because the
  browser and the coordinator provision the same runtime ids on the same server, and
  the introduction step changes when each side acts.

---

## Open questions

- **How a requirement is spelled beyond `kind`.** The object is decided; its other
  keys are not, and `tags` should wait for a board that needs one.
- **Where a runtime server gets its own tags** — process config, a file beside the
  mount secret, or something it derives about itself.
- **Ticket lifetime and rotation.** Long-lived and revocable is the minimum. Does it
  rotate on reconnect, and what does the coordinator show a person about which
  machines hold one?
- **A participant that connects claiming a runtime the board no longer has.** A stale
  ticket after the board changed — refuse and say so, presumably, but it needs
  deciding.
- **Pinning service versions.** The registry carries a version per service. Does a
  board ever pin it, and does that belong in `requires` or beside the service?

---

## Work breakdown (sketch)

1. **Preflight and status vocabulary.** Independent of the rest, and it removes
   today's half-deployed board with its misleading Stop button.
2. **Named remotes.** `remote` and `requires` on the runtime descriptor, a resolver in
   the person's client, refusal when a runtime gives more than one addressing mode,
   kind and registry checked before handover. Today's url-only boards go through
   untouched.
3. **Accept-only coordinator.** Tickets, the introduction step in deploy, the join
   endpoint, provisioning over the inbound connection, one connection per board,
   required vs transient participants, `error` naming what is missing.
4. **Retire the dialling path** once nothing uses it.
5. **Secrets.** The three contact points above.
6. **Docs.** A concepts page beside mounts and coordinator, and vocabulary entries.
