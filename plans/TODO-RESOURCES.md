# Resources: what a board needs from outside Readymade — for a fresh session

A board says what it needs from outside Readymade: a Postgres database, an
Ollama, an S3 bucket. The place that runs it provides one, by starting a
container, finding an installed one, or being told an address. Services name
the resource, never where it is.

Raised 2026-11-26, alongside starting the local servers from the app
([TODO-LOCAL-SERVERS.md](TODO-LOCAL-SERVERS.md)), which deliberately runs hkp's
own servers natively and leaves containers to this. Nothing here is
implemented, and nothing is decided beyond the first section.

---

## Why, and why not yet

There are many container images for things a service could use: databases,
object stores, search engines, model servers, queues. A board that can say "I
need a Postgres" and have one appear, configured and connected, opens all of
them without a setup guide per board. That could be the larger win of the two
plans.

But **no service needs it today.** `sql` is SQLite, and each board keeps its
own database with nothing to set up: that is a strength and stays the default.
What points outside Readymade now:

- **Ollama.** `ollama-prompt` (browser) takes an `endpoint`
  (`http://localhost:11434/api`), and the docs ask the person to start Ollama
  with `OLLAMA_ORIGINS='*'` so a page may call it. That is exactly the
  launch-configuration problem the local servers plan solves for hkp's own
  servers.
- **S3, perhaps.** `storage` puts its backend in a nested pipeline so that "S3
  or SQL the day a board needs that" changes nothing in front of it.

So this is designed now and built when the first service needs it. The plan is
to have the concept ready so that day doesn't invent one in a hurry.

---

## Decided

- **A board names a kind of resource, never an image.** Boards come from other
  people: shared, demos, Board Assist. A board that could say "pull and run
  `someone/image`" would be a supply-chain risk, and on Linux, access to the
  Docker socket is root.
- **Providing is the host's, not the board's.** The same board gets its Postgres
  from a container on a laptop, from a managed database on a coordinator's
  host, or from an address the person typed. The board says the same thing in
  each place.
- **Not for hkp's own servers.** hkp-node, hkp-python and hkp-rt run natively
  (GPU, audio devices, no Docker prerequisite); see the local servers plan.

---

## 1. In the board

Declared once, like `assets`, and referenced by scheme, like `hkp-asset://` and
`hkp-mount://`:

```json
"resources": [
  { "id": "db", "kind": "postgres", "version": "16" },
  { "id": "llm", "kind": "ollama", "models": ["llama3.2"] }
]
```

```json
{ "serviceId": "postgres", "state": { "database": "hkp-resource://db", "statement": "…" } }
```

- `hkp-resource://<id>` is a whole value, never part of a string, reserved beside
  `hkp-asset://` and `hkp-mount://`, and found by its scheme wherever it occurs
  in service state (`findMountRefs` is the precedent).
- A **kind** is a contract, not a product: what a service is handed when the
  reference resolves. Each kind lists the fields it gives (below) and what a
  board may ask of it (`version`, `models`, `buckets`).
- The board never holds an address, a port or a credential for a resource, the
  same rule that keeps `__hkpMount` from being authored.

### The first kinds

| Kind | A service is handed | A board may ask | Provided by, to start with |
|---|---|---|---|
| `ollama` | `{ url }` | `models` to have pulled | the installed Ollama app (native, GPU), else a container |
| `postgres` | `{ url, user, password, database }` | `version` (major), `extensions` | a container, or an address |
| `s3` | `{ endpoint, region, bucket, accessKey, secretKey }` | `buckets` | a MinIO container, or an address |

Further kinds (Redis, a search engine, a vector database) arrive with a service
that uses them, never ahead of one.

## 2. Resolution

The same arrangement as assets: the runtime that uses a resource resolves the
reference at the moment it is used, from a **resource store** it was pushed.

- Pushed by the client opening the board (playground, app) or by the
  coordinator (a deployed board): in the create payload, before a configure that
  names one, on attach, and whenever a binding changes. That's the asset store's
  lifecycle (`hkp-node/src/assets.ts`, `hkp-python/src/hkp/assets.py`,
  `hkp-rt/lib/include/assets.h`).
- **Reached from where it is used.** A container on a laptop is
  `127.0.0.1:<port>` to an hkp-node on that laptop, a different address to a
  runtime on another machine, and unreachable from a phone. A binding is
  therefore resolved per runtime: the store pushed to each runtime holds the
  address that runtime can reach, or says it can't, and the load fails naming
  the resource rather than handing on an address that goes nowhere.
- **Credentials are secrets.** A resolved resource carries a password or a key.
  It is resolved at point of use like `{{secret.…}}`, never written into
  service state, never in `getState`, never in a call report, and bound to its
  destination ([TODO-SECRETS.md](TODO-SECRETS.md)): the Postgres password is
  sent only to the Postgres it belongs to. The provider generates them; nobody
  types them.
- **The egress guard still applies.** A hosted server (`HKP_EGRESS=public`)
  refuses private destinations, and a container on its own host is one. A
  binding the host itself made is the case for letting exactly that destination
  through (`HKP_EGRESS_ALLOW`, added by the provider, for that address only).
  Open below.

## 3. Binding: the person's answer, kept

Opening a board that needs a resource nobody has bound is asked about, the way
an unknown remote name is (`hkp-frontend/src/core/remotePrompt.ts`):

> This board needs a **Postgres 16** database (`db`).
> **Start one here** · **Use one I have** · **Not now**

- *Start one here*: the provider in section 4 creates it.
- *Use one I have*: an address, and credentials kept in the vault.
- The answer is kept per board and resource id, so opening the board again
  binds the same one. *Not now* leaves the board loading, with the services
  that need it reporting that it isn't bound.
- Board Assist and the docs can say what a board needs before it's opened,
  because `resources` is in the document.

## 4. Providers

A provider turns a kind into something running and reachable. Several can
offer the same kind; the person's answer picks one.

### Containers (Docker Engine API)

- Spoken to over its local socket (`/var/run/docker.sock`,
  `~/.docker/run/docker.sock`, a named pipe on Windows, or `DOCKER_HOST`).
  That's HTTP, so no Docker library and no CLI is needed. Podman, Colima and
  OrbStack offer the same API.
- **A curated catalog.** Each kind maps to an image the app ships the
  reference for, pinned by digest (`postgres:16@sha256:…`), with the
  environment, the port and the volume it needs. A board can't add to it, or
  change any of these.
- **Anything outside the catalog** (a later "custom" kind, if ever) needs the
  person's consent in a native dialog showing the image and digest, its ports,
  its volumes and its environment, and is kept per image.
- **Constraints on every container:** ports published on `127.0.0.1` only; no
  `--privileged`, no host network, no added capabilities, never the Docker
  socket mounted in; volumes only under `<app data>/resources/<board>/<id>/`;
  labelled `readymade.board` and `readymade.resource` so the app finds its own
  and only its own.
- **Docker isn't there, or isn't running**: say which, and offer the other
  providers.

### Native

Finding what is already installed: the Ollama app on `11434`, a Homebrew
Postgres. Started with the settings the kind needs (`OLLAMA_ORIGINS` for a page
to call it) where the app may start it, otherwise only detected and checked.
For `ollama` on a Mac this is the better provider, because of the GPU.

### An address

The person's own server, anywhere. Nothing is started; the binding is checked
(it answers, the credentials work) when it is made and when the board opens.

### Later: hosted

A provider that offers a managed database for a deployed board is possible
and fits here. Anything commercial about it is planned outside this repository.

## 5. Lifecycle and data

- **Whose data.** A resource a board started holds that board's data, like its
  SQLite file today. The volume is named for the board and the resource id.
  Renaming a board must not lose it; the binding moves with it.
- **Stopping and removing are different.** Closing a board may stop its
  containers (or leave them running: open below). Removing a resource's data is
  only ever explicit, confirmed, and says how much is there.
- **Shared between boards.** Two boards may bind the same resource on purpose
  (one Ollama for everything). A shared binding is the person's choice when
  answering, never the board's.
- **Moving a board with its data.** Exporting a board that holds data in a
  resource is the open "board and data archive" question in
  [TODO-SOVEREIGNTY-AND-ADOPTION.md](TODO-SOVEREIGNTY-AND-ADOPTION.md): a
  `pg_dump` beside the board document is the obvious shape for `postgres`.
- **Watching.** Resources appear beside the local servers in the app: status,
  logs (the container's), stop, start, remove, the same supervisor view.

## 6. Where each host stands

| Host | Can provide | Notes |
|---|---|---|
| Desktop app | containers, native, an address | the main case |
| Playground in a browser | an address only | a page can't start anything |
| Phone | an address only | reaches what a desktop or coordinator provides, at an address it can reach |
| Coordinator (deployed board) | containers on its host, an address, later hosted | the coordinator binds for the runtimes it builds; a member never binds |

A deployed board's bindings belong to the coordinator, not to whoever
deployed it from a laptop. Deploying asks again where the laptop's binding (a
container on `127.0.0.1`) can't be reached from where the board will run.

## 7. The first one

**`ollama`**, because the service exists and nothing new is needed to use it:

1. `resources` and `hkp-resource://` in the board vocabulary (`board-json.md`,
   `runtime/board/`), and the store push beside the asset store's.
2. `ollama-prompt` reads its `endpoint` from a reference as well as from an
   address.
3. The native provider (the Ollama app, started or detected, with
   `OLLAMA_ORIGINS` set for the app's own origins), and a binding prompt.
4. The container provider, for a machine without the Ollama app.

That puts every part to work except credentials. **`postgres`** comes second and
brings them, together with the service that uses it: a Postgres dialect of
`sql`, or a service of its own (open below).

## Open questions

- **`sql` and Postgres.** One service with a `database` that may be a resource,
  so a board that outgrows SQLite changes one field? Or a separate `postgres`
  service, because the dialects differ (types, `RETURNING`, placeholders) and a
  statement that runs on one doesn't run on the other? The `sql` contract
  promises a statement runs unchanged between browser and node; Postgres would
  break that promise.
- **Containers when the board closes.** Stop them (resources cost memory), or
  keep them running while the app runs (opening the board again is instant)?
  Probably: stop with the app, keep while it runs, per-resource override.
- **Egress for a provided address on a hosted server.** Let exactly the bound
  address through automatically, or require the operator to allow it?
- **Versions.** A board asking `postgres` `16` gets 16.x. What happens when the
  catalog moves to a new minor, and when a board asks for a major the catalog no
  longer has?
- **Models.** `ollama` with `models: ["llama3.2"]` pulls gigabytes. Ask first,
  with the size, always.
- **The vocabulary.** *Resource*, *kind*, *provider* and *binding* are new words.
  The vocabulary (`docs/content/vocabulary.md`) is written by hand, so adding
  them is the person's call when this lands.
