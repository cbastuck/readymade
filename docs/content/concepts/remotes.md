# Remotes

How a board says which runtime server a runtime belongs on without writing down an address, and how those servers come to belong to a deployed board: they connect to the coordinator, which dials nothing.

---

## The problem

A board used to record **how to reach** a runtime — `"url": "http://127.0.0.1:8080"` —
and an address is only true from where it is dialled. That loopback address is a
different machine for everyone who opens the board, and for a coordinator in a
datacentre it is the coordinator itself.

Two things followed, and they are the two halves of this page:

- A **shared board** carried a fact about one person's network as though it were
  a fact about the runtime.
- A **deployed board** asked its coordinator to dial addresses out of a board —
  untrusted input — from inside whatever network the coordinator ran in. That
  needed an allowlist, a private-range policy, and still could not reach a
  laptop behind NAT.

---

## Naming a remote

A **remote** is a runtime server a client knows by name. Every host keeps a list
of them — the Add-runtime picker shows it, *Manage runtime servers* edits it —
and a board may name one instead of giving its address.

A runtime says where it runs in exactly **one** of two ways, both authored:

```json
{ "id": "node", "name": "Node", "type": "rest", "url": "http://127.0.0.1:8080" }
{ "id": "node", "name": "Node", "type": "rest", "remote": "Laptop" }
```

| Field | Says | Resolved |
|---|---|---|
| `url` | an address the person wrote | used as written. Every board from before remotes; valid forever |
| `remote` | a name | looked up among this client's remotes |

There is no third way that says only *what kind* of server would do and leaves
the client to pick one. A runtime may reference credentials, and those are
released to the server it lands on — so where it lands has to be something the
board said or the person can read off it, never a choice made on their behalf
among whatever servers they happen to keep.

### Both is an error, not a preference

No fallback and no precedence. A name resolves differently for each person, so
anyone who can put a board in front of you controls whether its name resolves.
If an unresolvable name fell back to a `url`, they would get two attempts at
making your client dial an address and need only the second. A runtime carrying
both is refused before anything is dialled.

`hkp://remotes/<name>` — the spelling boards used for the app's embedded runtime
before `remote` existed — is a name in a url's clothing. It **counts as a name**
(so it cannot sit beside a `remote`), and is still resolved by the host that
serves the `hkp:` scheme, which refuses a name it does not hold.

### Resolution is the person's client's, and is never written back

A name is resolved **only on the person's side**, against the remotes their
client keeps, when the board loads there. Nothing else resolves one: a
coordinator holds no name-to-address table, and a name in a deployed board is a
label for people.

- A name this client does not hold **fails the load**, naming the remote. There
  is nothing to fall back to, and a board quietly missing a runtime is worse
  than one that says which runtime server it wanted.
- A remote runtime that names **no** server — neither a `url` nor a `remote` —
  fails the load the same way. Nothing is chosen for it.
- The resolved address lives on the **live** runtime, beside the name it came
  from. A save writes the name and drops the address
  (`authoredAddressing`). That is what keeps the one-way rule enforceable: if
  resolution wrote into `url`, every resolved board would be in the state the
  rule forbids.
- **Export bakes.** Handing one concrete runtime to somewhere this client's
  names mean nothing substitutes the address and drops the name
  (`bakeAddressing`) — still exactly one way.

Nothing ever moves a runtime onto a machine other than the one it named: the
files, models, devices and credentials behind a runtime are not in the board, so
a copy elsewhere would deploy, report success, and be wrong.

The vocabulary and the lookup live in
`hkp-frontend/src/runtime/board/remote.ts`; `restoreBoard`
(`core/boardPersistence.ts`) resolves on load.

---

## Connecting to a coordinator

A coordinator **never dials** a runtime server. Every participant in a deployed
board connects *to it*: runtime servers on a laptop, runtime servers in a
datacentre, and the browsers that open the board.

One rule, and what falls out of it:

- **No confused deputy.** The coordinator makes no outbound connection on a
  board's say-so, so there is no address policy to maintain and nothing for a
  crafted board to aim it at.
- **No reachability requirement.** NAT and loopback are not special cases. The
  only thing that has to be reachable is the coordinator.
- **No address for the coordinator to hold.** It is told none and resolves none.

### Deploy is an introduction

The browser is the only party that reaches both sides — it holds the person's
session with the coordinator *and* with each of their runtime servers. So
handing a board over is an introduction, made by `deployBoard()`
(`hkp-frontend/src/core/deploy.ts`):

1. It asks the coordinator for a **ticket** per remote runtime
   (`POST /coordinator/users/<sub>/boards/<board>/tickets`).
2. It tells each runtime's server — at the address the name resolved to —
   *connect to this coordinator, with this ticket*
   (`POST <server>/coordinator-links`), over the session it already creates
   runtimes there with.
3. Each server opens a WebSocket to the coordinator's `/coordinator/join`,
   presenting the ticket, and says what it is: its kind, its registry, and
   whether that runtime is already running there.
4. Only once they have all connected is the board registered.

### What a ticket is

A bearer credential, and deliberately a narrow one: it speaks for **one runtime
of one board of one person**. The connection made with it can do exactly the
things a coordinator does to that runtime — build it, describe it, configure a
service, change what it logs, drive it, remove it — as the person who
introduced it, and nothing else.

| | |
|---|---|
| Who keeps it | the runtime server, beside its mount secret (`~/.hkp/<node\|python>/coordinator-links.json`, `0600`). The coordinator keeps only a **hash** |
| How long it lasts | until replaced or revoked. It is what a runtime server reconnects with after a restart or a dropped connection, with nobody present |
| Replaced | by deploying again — and only once that deploy went through. A ticket asked for while the runtime has one is **pending** beside it: its holder is welcomed and waits, and the server holding the first stays the board's. Registering the board makes the pending ticket the one that counts; the one before it is forgotten and its holder gives way. A deploy that fails part-way therefore costs a running board nothing |
| Taking over early | a pending ticket also takes over as soon as the runtime has no server connected. That is what happens when the *same* server is introduced again: it drops its old connection to make the new one |
| Revoked | when the board is deleted, or deployed without that runtime. The connection is closed |
| On the holder | a ticket the coordinator no longer holds ends the link for good: the runtime server drops it **and the runtime it was for**, which was the coordinator's and is now nobody's |

There is **one connection per runtime of a board**. Two boards on one machine are
two tickets and two connections, which keeps one board's traffic off another's
socket and keeps lifecycle and failure per board. A runtime server keys a link
by board as well as runtime id, and keeps the runtime it builds for it in that
board's own space, so two boards that both call a runtime `node` do not meet
(`concepts/cloud-boards.md`). Leaving a board is
`DELETE <server>/coordinator-links/<board>/<runtimeId>`.

### Required and transient

A cloud board already contains a browser runtime, run by whichever browser is
attached, and browsers come and go constantly. So "a participant is missing"
does not mean one thing:

| | Which runtimes | When it is away |
|---|---|---|
| **Required** | remote (`rest`) | the board is in `error`, **naming it** |
| **Transient** | browser | data arriving for it stops there, exactly as a `null` stops a pipeline, and the board stays `running` |

`error` is **not terminal**. A required participant that reconnects is taken
back: if it still has the runtime this board built — only the connection
dropped — the runtime is picked up as it is, live state and all. If it does not
— the server restarted — the runtime is rebuilt from the board's config. What
does not come back is the run.

A runtime server that reconnects to a board that has since been stopped has its
leftover runtime released, so stopping a board while a server is away does not
leave an orphan behind.

### The same thing on both restarts

Both sides keep exactly one thing about the connection — the ticket — so both
restarts end the same way:

- **A runtime server restarts.** It reconnects with its ticket; the coordinator
  rebuilds the runtime from the board's config.
- **A coordinator restarts.** A board that was running comes back in `error`,
  naming every runtime it is waiting for, and builds each as its server
  reconnects. A board that was stopped stays stopped.

No user token is involved in either.

---

## Credentials

Values flow from the person's client to the runtime server **they chose**, and
not through the coordinator:

- The introduction (step 2 above) carries the values for the references that
  runtime's services hold. Consent is asked for the **address the name resolved
  to**, never for the name — a remote's name is board-controlled and resolves
  differently for each person, so a grant keyed on it would follow the board
  wherever it pointed.
- The runtime server holds them with the link, in memory, and hands them to the
  runtime when the coordinator builds it. They are not sent to the coordinator.
- A runtime built without a value it references says so:
  `Runtime "node": needs configuration — its runtime server holds no value for
  imap.password`. That is what a board looks like after its runtime server
  restarted — the ticket survived, the values did not — and deploying again
  supplies them.

→ `plans/TODO-SECRETS.md` for the coordinator-side vault this does not replace.

---

## Which runtime servers can join

| Runtime server | Joins a coordinator |
|---|---|
| hkp-node | yes |
| hkp-python | yes |
| hkp-rt (C++), standalone or in a container | yes |
| hkp-rt, embedded in the desktop app | yes |
| hkp-rt, embedded in the iOS or Android app | **no**, deliberately — a phone suspends the app at will, the link would drop, and the board would go to `error`. The deploy preflight says so beforehand |

A server says whether it can in `GET /runtimes` (`coordinatorLinks: true`),
beside its kind and registry. On hkp-rt that is the host's decision: the library
connects to a coordinator only once its host has given it somewhere to keep
tickets (`Server::enableCoordinatorLinks`).

hkp-rt is single-tenant — one id space, an email allow-list — so its links have
no owner: whoever may create a runtime there may link one. It keeps its tickets
in `~/.hkp/cpp/coordinator-links.json`.

---

## Rough index into the source

| Concern | Where |
|---|---|
| `url` / `remote`: vocabulary, lookup, what a save keeps | `hkp-frontend/src/runtime/board/remote.ts` |
| Resolving on load | `hkp-frontend/src/core/boardPersistence.ts` (`resolveForRestore`) |
| Preflight, per runtime | `hkp-frontend/src/core/deployPreflight.ts` |
| The introduction | `hkp-frontend/src/core/deploy.ts`, `components/Toolbar/DeployDialog.tsx` |
| Tickets and accepted connections | `hkp-node/src/coordinator/participants.ts`, `join.ts` |
| The protocol over a connection | `hkp-node/src/coordinator/participantProtocol.ts` |
| A board over its participants | `hkp-node/src/coordinator/session.ts` |
| The runtime server's end | `hkp-node/src/coordinatorLinks.ts`, `hkp-python/src/hkp/coordinator_links.py`, `hkp-rt/lib/src/coordinator_links.cpp` (over `common/link_socket.cpp`) |
| Tests | `hkp-node/tests/coordinator-participants.test.ts`, `coordinator-session.test.ts`, `coordinator-links.test.ts`, `coordinator-restart.test.ts`, `coordinator-python.test.ts`, `coordinator-rt.test.ts`; `hkp-python/tests/test_coordinator_links.py`; `hkp-rt/tests/coordinator_links.test.cpp`, `link_socket.test.cpp`; `hkp-frontend/src/runtime/board/tests/remote.test.ts`, `core/tests/deploy*.test.ts`, `remote-resolution.test.ts`; `e2e/tests/cloud/deploy.spec.ts` |

---

See also: **Cloud boards** (`concepts/cloud-boards.md`) for deploying as a whole,
**Coordinator** (`concepts/coordinator.md`) for the role, and **Mounts**
(`concepts/mounts.md`) for the other thing a board names rather than addresses.
