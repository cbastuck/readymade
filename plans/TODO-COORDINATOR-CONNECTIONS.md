# Coordinator connections: participants connect in, nothing is dialled

Status: **built 2026-10-01** for hkp-node, hkp-python and the frontend. What the
system now does is documented in `docs/content/concepts/remotes.md` and
`docs/content/concepts/cloud-boards.md`; this file keeps the reasoning, the
decisions taken while building, and what is still open — see the last three
sections. hkp-rt cannot join a coordinator yet.

Two halves, coupled by what deploy checks before it hands a board over: **how a
board says which runtime server it wants** (a name — which matters
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

A runtime carries exactly **one** addressing mode, both authored:

- `url` — an address the person wrote. Every board that exists today.
- `remote` — a name, resolved by their client.

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

### Addressing by requirement — built, then withdrawn 2026-10-02

`"requires": { "kind": "python" }` let a board say what would do and had the
client take the first of its remotes of that kind. It was built on 2026-10-01
and removed the next day, after being tried:

- **Too little control over where a runtime ends up.** The answer depended on
  which remotes a client kept and in what order — nothing the board's author or
  the person opening it had decided about *this* board.
- **That is a credentials problem, not only a surprise.** A runtime's secrets
  are released to the server it lands on. A board that lets the client choose
  can land a runtime asking for secrets on a server nobody meant it for.
  Consent keyed on the resolved address does not rescue this: the person is
  asked about an address they did not pick.

So a runtime lands only where the board or the person **named**. With it went
the plans that hung off it — tags, version pinning, the "machine-bound remote"
marker — none of which had a board that needed them. What stays is the
**registry check** in the preflight: derived from the board's own services,
authored by nobody, and it chooses nothing.

### Preflight, and failing loudly

Placement is checked in the **browser**, before anything is handed over, and the
deploy dialog says per runtime which of these it is:

- resolved to a remote, which is running and accepted the person
- resolved, but the server is not running or refused them
- did not resolve on this client — naming the name
- resolved to a remote whose registry does not cover the board's services —
  listing what is missing

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

## What this retired

- `coordinator/urlGuard.ts` — its entire job was validating addresses the
  coordinator was about to dial. The allowlist, the private-range policy and the
  noted DNS-rebinding window went with it.
- `HKP_RUNTIME_URL_ALLOWLIST` and `HKP_ALLOW_PRIVATE_RUNTIMES`.
- The ordering trick in `handOverRuntimes()` was re-examined and **kept**: the
  browser and the coordinator still build the same runtime ids on the same
  server, so the browser still has to give them up before the coordinator
  builds them. The introduction happens before it, not instead of it.

---

## Decided while building — 2026-10-01

The open questions the concept left, and what was chosen. Each is small enough
to revisit; none was obvious enough to go without saying.

- **Ticket lifetime and rotation.** Long-lived, until replaced or revoked. It
  does **not** rotate on reconnect: the runtime server would have to persist a
  new ticket on every connection, and a write that failed would lock the machine
  out. Deploying again replaces it. The coordinator shows who holds one and
  whether they are connected (`GET …/boards/<board>/participants`), never a
  ticket; nothing in the UI reads that route yet.
- **Replacing is not revoking.** Asking for a new ticket invalidates the old one
  at once but leaves whatever is connected with it in place until the new
  holder connects. A deploy that never completes must not cost the running
  board a runtime.
- **A participant claiming a runtime the board no longer has** is refused: the
  ticket was revoked when the board was registered without that runtime (or
  deleted), so the upgrade answers `401`. A runtime server told so drops the
  link **and the runtime** — it was the coordinator's, and nobody else will
  release it.
- **A runtime server displaced by another** (the board deployed to a different
  machine) is closed with its own code and does the same. Without that the
  machine a runtime left would keep a copy running.
- **Picking up versus rebuilding.** A participant says in its hello whether the
  runtime is running there. The session picks it up only if *it* built it and it
  is still there — a dropped connection. Otherwise it builds: whatever is under
  that id was not built from this board (the copy the browser ran before it
  deployed, typically).
- **Nothing waits.** Registering a board does not wait for a participant; the
  introduction already did. A board whose runtime server is not connected is in
  `error` at once and comes up when it connects.
- **A restored board runs again by itself**, which the concept implied and
  `TODO-CLOUD-COORDINATOR.md` had parked as impossible ("auto-start on boot",
  "remembering that a board was running"). Both follow from tickets: the board
  store now keeps `stopped` and the ticket hashes.
- **`hkp://remotes/<name>` stays resolved by the host.** It counts as a name for
  the one-mode rule, but the native proxy that serves it goes on resolving it;
  routing it through the client's remote list would have changed how the
  embedded runtime is reached for no gain.
- **Credentials ride with the introduction.** Secrets contact point 3, in its
  simplest form: the browser hands the values to the runtime server the person
  chose, with the ticket; the server holds them **in memory** with the link.
  Not persisting them is deliberate — a plaintext secret store on a runtime
  server is a posture nobody decided on. The cost is stated below.
- **Session tokens are no longer used by the coordinator** and were left in the
  runtime servers. Removing the route is a separate change across three
  runtimes.

---

## Still open

- **hkp-rt has no coordinator link.** It needs an outbound WebSocket client
  speaking `participantProtocol.ts`, ticket persistence, and the six operations.
  Until then the preflight stops a deploy that places a runtime on it
  (`cannot-join`). The retired dialling path was the only way hkp-rt ever took
  part in a cloud board, and only without auth — it has no session-token route.
- **Credentials after a runtime server restart.** The ticket survives, the
  values do not: the board says `needs configuration — its runtime server holds
  no value for …`, and deploying again fixes it. Whether a runtime server gets
  an encrypted store for them is the same question as `TODO-SECRETS.md` B-b,
  asked of a different box.
- **The coordinator vault (B-b) is still unbuilt**, and contact point 2 — a
  grant keyed on the ticket's bound identity rather than an origin — is a
  constraint on it, recorded in `TODO-SECRETS.md`. A participant that is *not*
  on the person's own machine has no source of credentials but the introduction.
- **Authoring `remote`.** The Add-runtime picker still writes a
  `url`; a name is typed into the board's JSON. The picker
  writing `remote` for a named server is the obvious next step and changes what
  every newly built board saves.
- **Mobile.** The deploy sheet reports what stopped a deploy as a toast, with no
  per-runtime dialog, and the mobile cloud view reads a board's reasons from the
  listing rather than from the live snapshot.
- **Nested services are not in the preflight.** Only a runtime's own pipeline is
  compared with the registry.
- **Cloud view Start** re-registers without a preflight. It needs none for
  addresses any more, and reports a runtime server that is not connected by
  name.

---

## What was built

| Step | Where |
|---|---|
| 1. Preflight, honest deploy status, per-runtime dialog | `hkp-frontend/src/core/deployPreflight.ts`, `core/deploy.ts`, `components/Toolbar/DeployDialog.tsx` |
| 2. Named remotes | `hkp-frontend/src/runtime/board/remote.ts`; resolved in `core/boardPersistence.ts`; `meander/frontend/src/MeanderPlayground.tsx` holds the board until remotes are loaded |
| 3. Accept-only coordinator | `hkp-node/src/coordinator/participants.ts`, `participantProtocol.ts`, `join.ts`, `session.ts`; runtime-server end in `hkp-node/src/coordinatorLinks.ts` and `hkp-python/src/hkp/coordinator_links.py` |
| 4. Dialling retired | `coordinator/urlGuard.ts`, `HKP_RUNTIME_URL_ALLOWLIST`, `HKP_ALLOW_PRIVATE_RUNTIMES` and the coordinator's use of session tokens are gone |
| 5. Secrets | consent on the resolved address; values with the introduction; missing ones named per runtime |
| 6. Docs | `docs/content/concepts/remotes.md`, `cloud-boards.md`, `coordinator.md`, `board-json.md`, `vocabulary.md`, `testing.md` |

The manual checks the automated suites do not cover are in `TODO-TEST.md`.
