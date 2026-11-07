# Runtime

Where services actually run. A board has one or more, they are chained in order, and each one is a place with different capabilities — a browser tab, a Node process, a Python process, a C++ binary.

---

## Why there is more than one

A board is one app, but the things an app does do not all belong in the same
place. Drawing on a canvas belongs in the browser. Reading IMAP belongs on a
server. Running Whisper belongs where the model is. Audio DSP belongs in C++.

A **runtime** is that place. Splitting a board across several is what lets one
app span them, and the chain between them is what makes it one app rather than
several.

| Runtime | Language | How the browser talks to it | Typically used for |
|---|---|---|---|
| Browser | TypeScript | direct JS call — same process as the UI | UI, interaction, fast iteration, most services |
| hkp-node | TypeScript | REST + WebSocket | messaging, server I/O, webhooks |
| hkp-python | Python | REST + WebSocket | AI/ML, model inference |
| hkp-rt | C++ | REST + WebSocket | audio, high performance, embedded in the app |
| hkp-go | Go | REST | in development |
| GraphQL | — | GraphQL | legacy; one integration |

Not every service exists on every runtime. Where the same service id exists in
two runtimes it is meant to be the same *concept* with the same state contract —
`http-client` in node and hkp-rt share a UI panel for exactly that reason.

### Choosing where a step runs is a real decision

The same step can often be placed in more than one runtime, and where you put it
decides three things that no amount of configuration can change afterwards:

**Where the data goes.** A runtime is a physical place. A step in the browser
runtime on your laptop keeps its data on your laptop; the same step in a runtime
on a server puts that data on the server. This is not a privacy policy, it is
which machine the bytes are on. A board that transcribes a recording locally and
sends only the resulting text onwards is not promising that — it is what the
board does.

**What it can reach.** A runtime can touch only what its host can touch: the
microphone and camera of the device in your hand, an audio interface plugged
into it, files on that machine, a device on that network segment and nothing
else. If a board needs a thing, it needs a runtime on the host that has it.

**What it can afford.** Compute, memory, and the models installed. A phone can
drive a small speech model; a workstation can run a large one; a cheap always-on
box can do neither but never sleeps. Placement is how the work is matched to the
hardware — which is why the same service ids exist on several runtimes, so
moving a step is moving it in the list rather than rewriting it.


### Choosing, in practice

Four worked cases, to make those three axes concrete:

**Transcribing a private recording.** The audio should not leave the device, and
transcription needs a model. Put speech-to-text in a local runtime — hkp-rt
embedded in Readymade, or hkp-python on your own machine — and let only the
resulting text continue. The privacy property is structural: no step in the
board sends audio anywhere.

**A chat bot that answers while you sleep.** None of it can live in a browser,
because there is no browser open. Messaging belongs in hkp-node on a server, and
the board wants deploying so a coordinator keeps it running — see
`concepts/cloud-boards.md`.

**A live audio analyser with a UI.** Split it: capture and FFT in hkp-rt where
the sample buffers are, the display in the browser runtime where the person is.
What crosses between them is the analysis, not the audio.

**A model too big for your laptop.** Put hkp-python on the machine that has the
memory and leave everything else where it was. Only the prompt and the answer
travel.

The pattern in all four: put each step where its data should be and where its
work can happen, and let the board carry the results between them.

A consequence worth saying out loud: a board is portable in the sense that the
document is complete and the same JSON opens anywhere — but "anywhere" means
anywhere the runtimes it names can be reached. **A board built against a machine
on your desk is a board about your desk.** When one that worked yesterday will
not open, the runtime URL is the first thing to check.

---

## Where a runtime comes from

A board names runtimes; something has to be there to be named.

### The browser runtime: nothing to run

It is the tab. Adding one to a board takes no credentials, no address and no
server, which is why it is the one a board starts with and the one every example
assumes. A board may hold several; they run independently and share nothing, the
same isolation any two runtimes have.

What it does need is **permission**, for the services that reach hardware. A
camera or microphone service triggers the browser's own permission prompt the
first time it starts; denied, the service reports the failure in its panel and
recovers when the permission is granted and the page reloaded — the rest of the
board is untouched, because a permission belongs to the service asking, not to
the board. In the packaged desktop app the same permissions are declared in the
application bundle and granted once by the operating system.

### The servers

| Runtime | Started by | Listens on |
|---|---|---|
| hkp-node | `HKP_INSTANCE=<name> npx hkp-node`, a global install, or `docker run -p 8080:8080 -e HKP_INSTANCE=<name> cbastuck/hkp-node` | `PORT`, default 8080 |
| hkp-python | `hkp-python` from its virtualenv | `PORT`, default 8080 |
| hkp-rt | embedded in the Readymade app — it is already running when the app is | the app's `runtimePort`, off unless external access is enabled |

hkp-node and hkp-python take the same environment, because they answer the same
API: `PORT`, `HOST` (default `0.0.0.0`), `ALLOWED_ORIGINS`, and `EXTERNAL_HOST`.

An hkp-node is also a named **instance**, and will not start without one:
`HKP_INSTANCE` names the folder everything it keeps between runs lives in,
`~/.hkp/node-<instance>/` — its boards' data, the tickets it reconnects to
coordinators with, the boards it coordinates, its mount secret. A server's state
is otherwise invisible to whoever starts the next one, and two servers on one
machine would restore each other's tickets and deployed boards without a word.
Restarting under the same name is the same server; a second server is refused
while one is running as that instance. `hkp-node reset --yes` moves that folder
aside — to `~/.hkp/node-<instance>.reset-<date>T<hh-mm>/` — so the next start
begins with nothing restored.

`EXTERNAL_HOST` is the one worth understanding, because it is not the address the
server binds — it is the address the server *writes into what it hands back*: the
`outputUrl` a client is told to open its socket on, and the mount addresses it
publishes. It defaults to `127.0.0.1`, which is right until something on another
machine has to reach it, and then a runtime that binds every interface still
hands out an address only the host can dial. That is what makes a runtime look
provisioned and unreachable at once, and setting it to the LAN address is the fix.

### Who may call a server from a browser

A runtime server on a person's own machine usually runs without
authentication, on the grounds that only that machine can reach it. That keeps
other machines out. It does not keep out a web page: every site open in a
browser on the machine can address `127.0.0.1`, and a board's runtime is not
something a stranger's page should be able to build.

So a request that carries no credential is let in only when it does not come
from a foreign page, and that is decided from what a browser states and a page
cannot forge:

| The request says | It is |
|---|---|
| no `Origin` | a caller that is not a browser — a coordinator, another runtime, `curl` — and is let in |
| an `Origin` the server allows | let in, and told it may read the answer |
| any other `Origin` | refused |
| no `Origin`, and `Sec-Fetch-Site: cross-site` | a page fetching the address as an image or a script; refused |
| a `Host` that is a name the server was not given | a page that resolved its own name to this machine; refused |
| `Forwarded`, `X-Forwarded-For` or `X-Real-IP` | a request a proxy passed on; refused (below) |

What a server allows without being told is the origins Readymade's own apps
run from and any page served from the machine itself, whatever its port. Every
other site — the playground on the public website included — is allowed at the
server's end and nowhere else: `ALLOWED_ORIGINS` for hkp-node, hkp-python and a
standalone hkp-rt, which replaces the default with exactly what it names; and
**Settings → Access → Allowed websites** in the Readymade app, which adds to it
and applies at once.

**Behind a proxy, where a request comes from says nothing.** A reverse proxy
on the same host — nginx, Caddy — makes every caller a loopback one, at a name
the server knows. So a request that says a proxy passed it on is never let in
for where it comes from: a server without auth refuses it, and hkp-rt's pass
for loopback callers does not apply to it — it has to carry a token. A proxy
that adds none of those headers cannot be told apart, which is why a loopback
bind is a boundary only while nothing forwards to it: put a server behind a
proxy only with authentication on.

A refusal is a `403` with nothing in it a page can read. To the page that was
refused it is indistinguishable from a server that is not running, and that is
the point: a site somebody merely has open learns nothing about what runs on
their machine. The playground therefore says both things when a board's server
gives no answer — it is not running, or it does not allow this page — with
what to change for each, and waits. **Check again** asks the server once more,
and the board carries on by itself the moment it answers.

Three things this does not cover. A request carrying a verified token is let
in by the token, and the origin list then says only which pages may send one.
A mount is reachable by anyone holding its address, as it is meant to be. And
another *program* on the same machine — or another account on it — is not a
browser, states no origin and is let in: a loopback bind is a boundary against
other machines and, with this, against web pages, not against the machine's own
software.

### Where a hosted server may connect

The other direction. A board names destinations — an HTTP Client's URL, a feed,
an asset, a mail server, a model's base URL — and the server dials them. On a
person's own machine that is the point: a board talks to the printer, the NAS,
a model on the LAN. On a server other people's boards run on it is not: that
server's loopback, its private network and a cloud provider's metadata endpoint
(`169.254.169.254`, which hands out the machine's credentials) are reachable
from where it runs and are not a board's to reach.

So a server is told it is hosted with **`HKP_EGRESS=public`**, the same in
hkp-node, hkp-python and a standalone hkp-rt. A destination is then reached only
when every address its name resolves to is a public internet address — never
`127.0.0.0/8`, the private ranges (`10/8`, `172.16/12`, `192.168/16`), shared
address space (`100.64/10`), link-local (`169.254/16`), the IPv6 equivalents, or
an IPv6 address carrying one of those. Unset, nothing is refused; the desktop
app's embedded runtime is never told otherwise.

- **Judged on the address connected to**, not on the name a board wrote: a name
  can be pointed anywhere, and repointed between being checked and being
  dialled. Every redirect hop is judged the same way, and so is every spelling
  of an address (`2130706433` is `127.0.0.1`).
- **`HKP_EGRESS_ALLOW`** lists addresses or ranges reached anyway, an internal
  model server for instance. Addresses, not names, for the same reason.
- **A refusal says so** — "This server does not reach private addresses
  (10.0.0.5)" — where it would otherwise be a timeout or a misleading hint.
- **What the operator configured is not judged:** the link to a coordinator,
  the token issuer's keys, a model downloaded from a fixed release address.

The rule lives in one place per runtime (`hkp-node/src/egress.ts`,
`hkp-python/src/hkp/egress.py`, `hkp-rt/lib/include/egress.h`), and each
runtime's tests read its sources and fail on any other way of opening a
connection, so a service added later cannot quietly go around it.

On a machine you run, add the same rule in its **firewall** as a backstop: drop
the hosted process's traffic to those ranges (by its user, with
`iptables`/`nftables` owner matching, or as a container's egress policy). It
covers what code cannot — a library opening a socket nobody listed. Mind what
the server itself needs on the private network: another runtime's mount on the
same host, the coordinator, a database. The code-level rule exempts those by
where they come from; a firewall rule sees one process and has to be told.

### What a token must carry

Every server checks a token the same way (hkp-node `src/auth.ts`,
hkp-python `hkp/auth.py`, hkp-rt `http/auth.cpp`, the website's `api/auth.php`):
signed with RS256 by a key of the issuer it names, that issuer being
`https://<AUTH0_DOMAIN>/`; addressed to one of the accepted audiences
(`AUTH0_AUDIENCE`); carrying an expiry that has not passed and a subject; and
not used before its `nbf`. Expiry and subject must be *there* — a check that
only applied when they were present would accept a token without them. A minute
of clock skew is allowed. On the desktop, an issuer listed in `settings.json`
without audiences accepts nothing, rather than a token minted for any
application of its tenant.

### Opening a socket without the token in its address

A browser cannot set a header on a WebSocket handshake, so a token that
authenticated one would have to ride in the address — and an address is what
proxies and access logs keep. So the browser buys a **ticket** first:
`POST <server>/ws-tickets` with its token in the `Authorization` header, like
any request, answered with a random value good for one socket, for 30 seconds.
The socket is opened with `?ticket=` (`hkp-frontend/src/runtime/rest/wsTicket.ts`).
A ticket remembers what checking the token found — who the caller is, and
whether the allowlist lets them own — so a coordinator's bridge, which members
not on the allowlist open too, is judged exactly as the token would have been.

Every runtime server and coordinator issues them. `?access_token=` is still
accepted from a client that predates tickets, and the browser falls back to it
only for a server that has no `/ws-tickets` route.

### What an expression may reach

A Map's terms and a Filter's predicate are expressions a board wrote, evaluated
inside the runtime — on a hosted server, inside a process everyone it lets in
shares. The evaluator (hkp-node `src/expressionEval.ts`, and its twin in the
browser runtime) is kept in the repository and changed like security code:
an expression reads and calls what its scope hands it and nothing else. It has
no assignment, a name is only one of the scope's own properties, and
`constructor`, `prototype`, `__proto__` and every other `__` member are refused
however they are reached, which closes the way from a value to the code behind
it.

### Where a board may read and write files

A board is a document somebody wrote, and opening one builds its runtimes. A
service on hkp-rt that opens a path the board names — a
[Filesystem](../services/filesystem.md)'s file, a Monitor's log, a Cache's
folder, a WAV to read — would otherwise open it wherever it is: beside the
desktop app that is `~/.hkp`, which holds the vault, the remembered grants and
the settings that say which websites may call the runtime; on a server it is the
mount secret, the coordinator tickets and the process's environment.

So hkp-rt opens such a path only inside a **folder it was given**:

| hkp-rt runs as | Default folder | Others |
|---|---|---|
| the desktop app's runtime | `~/.hkp/cpp/files` | **Settings → Access → Folders boards may use**, applied at once. A folder holding `~/.hkp`, or inside it, is refused — the home folder among them |
| a standalone server | `HKP_FILES_DIR`, else `~/.hkp/cpp/files`; empty for none | `HKP_FILES_ALLOW`, absolute paths separated as `PATH` is |
| the iOS and Android apps' runtime | none | — |

A relative path is taken from the default folder, which is what makes a board
that writes `"recordings"` portable. A path is judged on what it is rather than
how it is spelled: `..` and symlinks are followed before it is compared, and a
name that arrives with the data — a file inside a configured folder, a cache
entry's name — is taken inside that folder whatever it says. The rule lives in
one place (`hkp-rt/lib/include/files.h`); every service resolves through it, and
a test fails on a file opened any other way. The test reads hkp-rt's own sources,
so a library that opens files is closed where it is set up: Inja's `include`,
which would read any path a template names, is switched off wherever hkp-rt
renders one (`hkp-rt/lib/src/common/inja.h`).

What it does not cover: hkp-rt has one tenant, so everyone a hosted server lets
in shares its folders; paths the operator names — a runtime config, plugins —
are the operator's; and a folder should hold nothing but what boards may have,
because a board that may write there may write all of it. The models the speech
and text-generation services load are named by path too and are not confined:
the model library reads them, and a file that is not a model fails to load.
The one way any of it comes back is speech-to-text's `tokensPath`, the
vocabulary a transcript is spelled from: a file shaped like one, should it load,
spells the transcript.

### Adding one to a board

In the app: the runtimes menu, **add an external runtime**, a name and a host URL
(`http://localhost:8080`). The name is yours; the URL is what is dialled.

A saved server and the board are separate things, joined by the server's
**name**. The list of servers is the host's — kept by whoever is running the
app, edited and deleted there — and a runtime added from it gives the board the
name and nothing else: `"remote": "node"` for a server that answers to `node`,
`"remote": "Laptop"` for one that is only called that. The board holds no
address at all, and opens on whichever server the person opening it keeps under
that name, on whatever port and machine that is for them.

So a board depends on the name staying answered. Renaming a server keeps the
old name as an alias, and a name nobody is kept under any more is asked about
when the board opens — *which runtime server is `Laptop`?* — rather than left
to fail (`concepts/remotes.md`). A board that carries a `url` instead, written
by hand or from before any of this, still opens exactly as it did.

`hkp://remotes/<name>` is the other way in, and it means something narrower than
it looks: it addresses the runtime **the app itself hosts**, under the name that
app runs as — every other remote is listed with its real URL. A name that is not
the app's own therefore names nothing and is refused, rather than being quietly
answered by whichever runtime happens to be embedded
(`meander/backend/remoteRoute.h`). A board pinned to a runtime that is
not running should fail visibly, not run somewhere else.

---

## The chain

Runtimes run **in board order**: the output of one is the input of the next.

```
runtimes[0]  →  runtimes[1]  →  runtimes[2]
```

The step between two runtimes is `onRuntimeResult()` in
`hkp-frontend/src/views/playground/Board/index.tsx`: when a runtime finishes, it
finds the next runtime in the array and calls its `processRuntime()`. Two things
about that step are worth knowing:

- **`null` stops the board.** The chain only continues `if (result !== null)`.
  The same value that stops a pipeline inside a runtime also stops the chain
  between them.
- **The board is driven from the first runtime.** The `playBoard` action calls
  `processRuntime` on `runtimes[0]`; everything after that is the chain. A
  service can also emit on its own (a Timer, an HTTP request arriving), which
  starts the chain from wherever that service sits.

For a deployed board the same chaining is done by the coordinator
(`routeResult()` / `nextRuntime()` in `hkp-node/src/coordinator/session.ts`),
including the case where the next runtime is a browser runtime it must reach
over the bridge.

Either way the result passes **through whoever runs the board** — runtimes do
not dial each other — and it travels on the sockets each runtime already has to
it. What cannot be JSON goes as a YAS frame: a `FloatRingBuffer`, and bytes,
which arrive in the next runtime as bytes (`Uint8Array` in the browser, a
`Buffer` in hkp-node, `BinaryData` in hkp-rt and hkp-python) — an encoder's
output handed to a server in another runtime, say. Everything else is JSON.
Results enter the next runtime in the order they were produced.

---

## What crosses a runtime boundary

Because a runtime is a physical place, it is worth being precise about what
actually leaves one.

In normal operation:

| What crosses | When |
|---|---|
| **The result** a runtime hands to the next | every pass — this is the flow the board describes |
| **Configuration**, and the state a service reports back | whenever a service is configured or reports; the coordinator keeps the last state of every service, which is how whole-board questions are answered |
| **Log entries** | only while the board has logging switched on — see `concepts/logging.md` |

Everything else — the intermediate values passing between the services inside
one runtime — stays there. A runtime is a box that can be closed.

**With one exception, and it is the useful one.** Attach a UI to a runtime and
it reports each call its services make: a pair of notifications around every
call (`{__internal: {state: "call-process"}}` before it,
`"call-process-finished"` after it). That is what makes the panels live: the
processing indicator, the output plug lighting, the overview's activity.

**What a report carries depends on Capture mode.** Without it, a report says
only that the call happened and, when it ends, whether it passed nothing on
(`stopped: true`). With it, a report also carries the value going in and the
value coming out, which is what the Flow Inspector shows. What passes between
the services of a run is private, and only what a board outputs is public. So
the values leave a runtime only while someone building the board asks to see
them:

- **The switch** is the Capture button beside the toolbar's Play buttons, or
  for a deployed board its owner's in the Cloud Boards view. Opening the
  inspector while it is off asks whether to turn it on. On a phone it is the
  round button beside Play in the top bar, and in a deployed board's top bar
  on the Cloud tab. A service's card, tapped, expands to show what it passed on
  last, with its own panel a tap further (**UI**), and its **Inspect** opens
  the inspector, which is also **Flow** in the
  service's sheet; both ask the same question in place
  (`views/playground/mobile/capture.tsx`, `MobileFlowInspector.tsx`).
- **It is never saved.** It is not in the board document or a runtime's
  configuration (`PATCH /runtimes/:id/state` sets it on a running runtime and
  answers it, and nothing builds a runtime with it). A board always opens with
  it off. A deployed board's coordinator holds it in its session only, and it
  ends when the owner's last bridge to the board closes.
- **Where it is applied:** where a report leaves. In hkp-node and hkp-python
  that is the server's two exits, the notification socket and the coordinator
  link (`outgoingPayload`). In hkp-rt it is where the report is made, which a
  nested pipeline asks of the runtime around it (`capturesCalls`). In the
  browser it is `serviceState.ts`. A pipeline nested at any depth follows the
  runtime that holds it.

Even with Capture mode on, a report carries a value only up to 5 MiB. Above
that, a description takes its place, `{"__hkpTooLarge": {type, bytes, exact,
preview}}`: what the value is, how large (`exact` is false where counting
stopped at the limit), and how it begins. The Flow Inspector shows the
description and will not run it again. Without the limit, a value that never
needs to leave its runtime would leave it anyway, once for every service it
passes through. On a deployed board that is past the coordinator's frame limit,
and enough to close the runtime's connection. The rule is the same in every
runtime (`callReport.ts`, `call_report.py`, `call_report.h`).

A phone keeps what the inspector shows for the **whole board** rather than per
service frame: it opens a service only when asked, so a history begun then
would miss everything before it. The mobile canvas listens to every service a
runtime holds from the moment the board is shown (`boardFlow.tsx`), and the
same listening lights a service's card while it runs. Both read a report with
the desktop's rule (`readCallReport` in
`ui-components/service/flowRecords.ts`). A service nested inside another is
not listened to there yet.

When nothing is attached, nothing is sent at all. This is not a filter applied
afterwards: the browser drops a notification with no target (`hasCallbacks`),
and a runtime server returns early when its socket set is empty
(`sendJsonNotification`).

The caveat is a service's own notifications. A Monitor shows what passed
through it, and an error message can quote a value. Capture mode covers call
reports, not what a service chooses to say. And **a deployed board's
coordinator holds its own socket to every runtime it provisioned**, so on a
deployed board, assume there is always a listener for what services say. A step
whose intermediate data must not leave its machine belongs on a board you own
yourself.

---

## Inside a runtime: the pipeline

Each runtime owns an **ordered list of services**, and that order is the wiring.
The browser's loop (`BrowserRuntimeScope.next()`) is the shortest illustration of
the contract every runtime implements:

```ts
for (let i = position + 1; !!services[i] && result !== null; ++i) {
  svc = services[i];
  if (svc && !svc.bypass) {
    result = await svc.process(params);
    params = result;
  }
}
```

Three things fall out of those five lines: services run in order, a **bypassed**
service is skipped rather than removed, and `null` ends the pass. `next()` also
takes a *starting* service — which is what makes the pull and early-return
patterns below possible.

### Control flow

Four mechanisms, and they are not all implemented everywhere:

| Mechanism | How | Runtimes |
|---|---|---|
| **Stop** | return `null` — nothing downstream, and nothing in the next runtime, runs | all |
| **Early return** | return a `ControlFlowData` / `makeEarlyReturn` — skip the rest of this pipeline but carry a result out | hkp-rt, hkp-python |
| **Inversion of control (pull)** | return `null`, then drive the services after you yourself and act on their result | all (`app.next`, `host.processFrom`, `next()` / `nextAsync()`) |
| **Deferred / multi-emit** | answer later: `deferCompletion()` returns Null and suppresses the finish event, a later `emit()` delivers the real result | hkp-rt (`emitResult` in node) |

hkp-node and the browser break on `null`/`undefined` only — do not write a board
that relies on early return there. The loops to read are
`hkp-rt/lib/src/runtime.cpp` (`processFrom`), `hkp-node/src/runtime.ts`
(`processFromIndex`), `hkp-python/src/hkp/runtime.py`, and
`BrowserRuntimeScope.next`.

The canonical use of pull is a cache: on a **hit** it early-returns the cached
value; on a **miss** it stops the push, lets the services behind it fetch, keeps
what they produced, and emits that.

---

## Leaving the line

The chain and the pipeline are the default shape, not the only one. A service can
reach a *named* service or runtime and act on it directly:

| Mechanism | What it does | Where |
|---|---|---|
| `app.getServiceById(uuid)` | the live instance of another service in this runtime | `AppImpl` |
| `app.configureService` / `configureServiceInRuntime(runtimeId, uuid, config)` | reconfigure a service here or on another runtime | `AppImpl` |
| `app.processRuntimeByName(name, params)` | run a whole runtime by its name, out of order | `AppImpl` |
| `app.next(svc, result)` | emit as if `svc` had just produced this — the services after it run, it does not | `AppImpl` |
| **Configurator** service | calls `configure()` on `targetServiceUuid` (+ optional `targetRuntime`), then stops by default | `services/Configurator.ts` |

These exist for actions such as a panel reconfiguring a service elsewhere on
the board. Processing still follows the ordered services or a nested pipeline.

**They are `goto`, and they cost what `goto` costs.** Two parts of the board now
know about each other, neither can be moved or reused alone, and the ordered list
no longer tells you what runs. Every such reference is also a field the generic
machinery must know by name — `targetServiceUuid`, `targetRuntime` and friends
are in `KNOWN_REFERENCE_FIELDS` (`core/forkBoard.ts`) precisely so a fork can
rewrite them; anything a service invents for itself is not carried across.

So: use them when the shape really is a cycle, and reach for **nesting** first
everywhere else. A nested pipeline is a step in the outer one — the host knows
its pipeline, the pipeline knows nothing of its host — and that ignorance is what
makes the group movable and readable. `join` is the pattern to imitate: a nested
pipeline whose result is merged *beside* the input, so a value can be computed
where it is needed instead of fetched from somewhere that has to be named.

---

## How the browser talks to a runtime

Three abstractions, all in `hkp-frontend/src/types.ts`:

| | What it is |
|---|---|
| `RuntimeApi` | the verbs, per runtime *type*: `addRuntime`, `restoreRuntime`, `processRuntime`, `addService`, `configureService`, `getServiceConfig`, `rearrangeServices`, … |
| `RuntimeScope` | one *live* runtime: its descriptor, its registry, `onResult`, and how to close it |
| `AppImpl` | what a **service** may do — `notify`, `next`, `log`, `createSubService`, `coordinator`, … |

There is one `RuntimeApi` implementation per runtime type
(`runtime/browser/BrowserRuntimeApi.ts`, `runtime/rest/RuntimeRestApi.ts`,
`runtime/graphql/…`), and the board picks the one matching `runtime.type`. This
is the seam that lets a cloud board swap in a REST api that talks over the
coordinator's bridge instead of dialling the runtime
(`views/cloud/bridgeRuntimeApi.ts`) without anything else noticing.

Runtime types carry two deprecated aliases — `realtime` → `rest` and `remote` →
`graphql` — normalised by `toCanonicalRuntimeClassType()`. Boards in the wild
still use them, so always compare canonical forms.

---

## Provisioning: `GET` attaches, `POST` provisions

For a remote runtime, `restoreRuntime()` in `runtime/rest/RuntimeRestApi.ts`:

1. `attachRuntime()` — `GET /runtimes`, find this id, and compare **service
   identity only** (uuid + serviceId, in order — never state, which legitimately
   drifts). Same board still running there? Attach to it, and re-push secrets,
   because a runtime that restarted still has its services and no longer has
   their credentials.
2. Otherwise `POST /runtimes` and build it.

> The verb is the intent; no server infers it.

A `RuntimeRestScope` then opens **one WebSocket per runtime** to the `outputUrl`
the server returned. That socket carries results and notifications — and it is
also what keeps the runtime alive, because of the lifecycle flag below.

### Lifecycle is declared, never inferred

In the create payload, by whoever creates the runtime:

| `garbageCollected` | Meaning | Who sends it |
|---|---|---|
| `true` | reap when the last client socket closes | a browser — its runtimes should not outlive the tab |
| absent / `false` | persist until an explicit `DELETE` | a coordinator, a config file, a script |

The default is persist, and a runtime nobody ever connected to is never reaped:
cleanup happens when a client *goes away*. All three servers honour it, pinned by
`hkp-node/tests/runtime-lifecycle.test.ts`,
`hkp-python/tests/test_runtime_lifecycle.py`,
`hkp-rt/tests/runtime_lifecycle.test.cpp`.

---

## Multi-tenancy

A runtime server is shared. Runtimes are namespaced by the authenticated `sub`,
so two people loading the same board each get their own runtime rather than
fighting over one (`TenantRuntimes` in `hkp-node/src/runtime.ts`). Every route
resolves runtimes through one of those views, so a handler cannot reach another
tenant's runtime even by id.

This is also why a service that must be reachable from outside cannot bind a
port of its own — see `concepts/mounts.md`.

---

## What a runtime carries besides services

- **A registry**: what services this runtime can create. Sent back when the
  runtime is provisioned, and used to offer the right service list and pick the
  right UI panel (`ServiceRegistry` per runtime id).
- **A server kind**: remote servers report what they are (`"server": "node"`,
  `"python"`, `"c++"`) beside the registry, and the runtime header shows it
  next to the `rest` badge. It lives on the live scope, never in the board — the
  same board can point a runtime at a different server tomorrow.
- **State**: presentation and per-runtime settings, e.g. `color`,
  `wrapServices`, `minimized`, `logData` — `runtime.state` in the board.
- **Where it runs**, for remote runtimes: a `url`, or a `remote` — the name of
  a runtime server the client opening the board keeps (`embedded`, `node`,
  `python`, or a name of the person's own; `concepts/remotes.md`).
  `hkp://remotes/<name>` addresses the app's own embedded runtime (above);
  `HKP_RUNTIME_HOST` is substituted at load for boards that cannot know the host
  when they are written.
- **Bundles**: optional plugin libraries a runtime loads (`bundles[]`).
- **Custom actions**: host-level buttons a runtime can offer.

---

## Sub-runtimes

Every runtime supports a `sub-service`: a service that owns an ordered pipeline
of its own and runs it as one step of the outer pipeline. That nested pipeline is
a full runtime pass with the same rules — which is what makes reusable
higher-level building blocks possible, and what `http-server-subservices` uses to
answer a request with a pipeline rather than a single service.

Implementations: `runtime/browser/services/BrowserSubService.tsx`,
`hkp-node/src/services/sub-service.ts`, `hkp-rt/lib/src/services/sub_service.h`
(+ `sub_runtime.cpp`).

---

## Rough index into the source

| Concern | Where |
|---|---|
| Types (`RuntimeDescriptor`, `RuntimeApi`, `RuntimeScope`, `AppImpl`) | `hkp-frontend/src/types.ts` |
| Runtime-to-runtime chain | `hkp-frontend/src/views/playground/Board/index.tsx` (`onRuntimeResult`) |
| Browser runtime | `hkp-frontend/src/runtime/browser/` (`BrowserRuntimeApi.ts`, `BrowserRuntimeScope.ts`, `BrowserRuntimeApp.ts`) |
| REST runtime client | `hkp-frontend/src/runtime/rest/` (`RuntimeRestApi.ts`, `RuntimeRestScope.ts`, `Message.ts`) |
| Board load / restore | `hkp-frontend/src/core/boardPersistence.ts` |
| Node runtime + tenancy | `hkp-node/src/runtime.ts` |
| Python runtime | `hkp-python/src/hkp/runtime.py` |
| C++ runtime + sub-runtime | `hkp-rt/lib/src/runtime.cpp`, `sub_runtime.cpp` |
| Folders an hkp-rt board may use | `hkp-rt/lib/include/files.h`; the desktop's in `meander/backend/fileFolders.h` |
| Chain for deployed boards | `hkp-node/src/coordinator/session.ts` (`routeResult`, `nextRuntime`) |

---

See also: **Board** (`concepts/board.md`), **Service** (`concepts/service.md`),
**Mounts** (`concepts/mounts.md`), **Units and compositions**
(`concepts/units.md`) — the runtime is the axis a unit is projected along.
