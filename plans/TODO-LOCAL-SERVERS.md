# Local servers, started by the app — for a fresh session

The desktop app starts, stops, restarts and watches hkp-node and hkp-python on
this machine, and starts them with the settings the person chose in the app. A
server is either **managed**, a version the app installed and keeps itself, or
**from a folder**, a checkout the person pointed it at. A server started with the wrong settings stops
being something a person finds out about from a browser console.

Raised 2026-11-26, after a member page on `localhost:4000` was refused by an
hkp-node started with `npm run withCoordinator`, whose
`ALLOWED_ORIGINS=http://localhost:8555` allows that one origin and nothing else.
Nothing here is implemented.

---

## Decided already

**Local only.** Only servers on this machine, started by this app. A remote
server's settings stay its launch configuration. Changing them over the network
would need an operator identity apart from owners, a route that can't change
who may sign in, step-up authentication and an audit log. That is more surface
than the benefit is worth now.

**No settings route on the servers.** Starting the server is what lets the app
configure it: the settings travel as the process's environment, and changing
one is a restart from the app. hkp-node (`dotenv`) and hkp-python (`_load_env_file`
in `hkp/__main__.py`) both leave a variable that is already set alone, so what
the app passes wins over the server's own `.env`, and the `.env` still fills in
the rest, typically the Auth0 settings.

**Two sources, one supervisor.** *Managed* is the default and what somebody
who only uses Readymade gets: the app installs the server version that belongs
to its own release and runs it. *From a folder* is for working on a server:
the person's checkout, run as it is. Both are started, stopped and watched the
same way, and both can be kept as `node` / `python`. Only how the command is
found differs (section 2).

**Native, not Docker.** Docker on a Mac runs Linux in a virtual machine: no
Metal GPU for hkp-python's models (`faster-whisper`, `kokoro-onnx`,
`llama-cpp-python`), no audio devices for hkp-rt, and Docker Desktop as a
prerequisite. Containers are for resources a board needs from outside
Readymade (Postgres, MinIO, …), which are their own plan:
[TODO-RESOURCES.md](TODO-RESOURCES.md).

**Desktop only.** macOS, Linux and Windows. iOS and Android can't run these
servers, and the native app there has nothing to start.

**No new dependency.** The desktop backend already starts processes
(`fork`/`execvp` for `open`/`xdg-open`, `meander/backend/main.cpp`), and the
macOS entitlements (`meander/hkp-saucer.entitlements`) don't sandbox the app.
`posix_spawn` and `CreateProcess` cover what is needed. A library (`reproc`,
tiny-process-library) would save some Windows code and is not worth the
dependency. If the Windows half turns out larger than expected, look again then.

---

## 1. The supervisor (desktop backend)

A `ServerSupervisor` in `meander/backend/`, with its rules in a header that
builds without saucer, as `pageTrust.h` does, so it is tested on its own.

- **A configured server** is a kind (`node` | `python`), a source (a managed
  version, or a folder), a port, the settings below, and optionally the
  interpreter's path. It is kept with the app's other settings
  (`meander/backend/settings.h`).
- **Starting.** The command is the kind's and the source's, fixed in native
  code, never sent by the page:

  | Kind | Source | Runs | Notes |
  |---|---|---|---|
  | `node` | folder | `node_modules/.bin/tsx src/index.ts` (or `npm run dev`), in the folder | needs `npm install` done once; say so when `node_modules` is missing |
  | `python` | folder | `uv run --locked python -m hkp` (what `run_server.sh` runs), in the folder | needs `uv`; say so when it isn't found |
  | `node` | managed | `node <install>/node_modules/hkp-node/dist/src/index.js` | see section 2 |
  | `python` | managed | `<install>/.venv/bin/hkp-python` | see section 2 |

  `PORT` is always the app's to give. Both servers default to 8080, so two
  started with nothing said would collide.
- **One process group per server** (a Job Object on Windows), so stopping it
  stops what it started (`npm` → `tsx` → `node`, `uv` → `python`). Stop is
  SIGTERM to the group, then SIGKILL after a grace period. hkp-node already
  exits cleanly on SIGINT and SIGTERM (`hkp-node/src/index.ts`).
- **Logs.** stdout and stderr go to a bounded buffer per server (lines, not
  bytes; the last few thousand), which the page reads and is told about as
  lines arrive.
- **Status.** Not started, starting, running, exited (with the exit code and the
  last lines of the log), and whether the port answers. "Running" means the port
  answers, not that the process exists. A server that exits within a few
  seconds of starting says why, from its log.
- **When the app quits**, every server it started is stopped.
- **When the app crashes**, its children must not keep running. See section 3:
  the servers watch their stdin.
- **A port already in use** when starting: say which process holds it, where the
  OS says (`lsof` on macOS and Linux). That is the usual way to find a server
  left running from a terminal, and it is the person's to stop. The app stops
  only what it started.

## 2. Managed: the app installs a pinned version

What `npx hkp-node@<version>` and `uvx hkp-python@<version>` would do, but
into a folder the app owns, so it's deterministic, works offline after the
first install, and can be updated and rolled back explicitly. `npx` and `uvx`
run from caches that get cleaned, and resolve again when they do.

- **Where:** `<app data>/servers/<kind>/<version>/`, e.g.
  `~/Library/Application Support/Readymade/servers/hkp-node/1.0.15/` on macOS.
  Its data stays where the server keeps it anyway (`~/.hkp/node-<instance>/`,
  `~/.hkp/python/`), so changing version keeps the boards, databases and mount
  secret.
- **Installing:**
  - hkp-node: `npm install --prefix <install> hkp-node@<version>`.
  - hkp-python: `uv venv <install>/.venv` then
    `uv pip install --python <install>/.venv hkp-python==<version>`, with the
    extras the person turned on (`llm` compiles llama.cpp, so it takes minutes
    and a compiler; show the install log, which the supervisor already
    captures).
  The install itself runs under the supervisor, so its progress and failure
  look like a server's.
- **Which version:** the app carries a manifest of the server versions that
  belong to its release (`hkp-node` 1.0.15, …). The app version
  (`hkp-frontend/package.json`) and the servers' versions are independent
  numbers, so "the same version" is not a rule that exists. The manifest is
  what says which frontend and which servers go together, so a person can't
  end up with a server older than the protocol the app speaks. Kept beside
  `scripts/check-version-sync.mjs` and checked by it: a release whose manifest
  names a server version that isn't published fails the check.
- **Updating:** a new app release brings a new manifest. A managed server not on
  it is offered the update, installed beside the old one, switched to on the
  next restart, and the old version is kept until the new one has started
  once. A version nobody uses is removed after that.
- **Pinned all the way down.** A published npm package's dependencies are
  resolved at install time, so the same version can install different code on
  different days. hkp-node should publish an `npm-shrinkwrap.json`, which npm
  honours for a published package. hkp-python should be installed from a lock:
  `uv export --format requirements-txt --hashes` per release, shipped with the
  manifest and installed with `--require-hashes`.
- **Finding `npm` and `uv`:** as in section 5. Beyond that, `uv` is
  one static binary the app can download itself (pinned, with its checksum
  checked) into `<app data>/tools/`. `node` is offered the same way from the
  official distribution (`SHASUMS256.txt`) only when it isn't installed, never
  replacing the person's own.
- **Settings the app owns.** A managed server has no `.env` of its own, so
  what a folder's `.env` gives (the Auth0 settings) comes from the app: the
  same sign-in configuration the app itself is built with, set natively, never
  from the page.

**Publishing first.** hkp-node is on npm (1.0.15, `bin: hkp-node`). hkp-python
isn't on PyPI (`/pypi/hkp-python/json` answers 404). Until it is, the managed
python source is `uv pip install git+<repo>@<tag>#subdirectory=hkp-python`, with
the tag in the manifest. Both should be published by the same release job that
builds the app, so the manifest can't name something that doesn't exist.

## 3. In the servers: exit when the app goes away

`HKP_EXIT_ON_STDIN_CLOSE=1` makes a server exit when its stdin reaches EOF. The
app starts each server with a pipe on stdin and never writes to it. If the app
dies, the OS closes its end and the server exits. This works on every platform,
unlike `PR_SET_PDEATHSIG`, which is Linux-only. It's a few lines each:

- hkp-node: `process.stdin.on("end", shutdown)`, only when the variable is set,
  so a server started from a terminal behaves as now.
- hkp-python: a thread reading `sys.stdin` until EOF, then the same shutdown as
  SIGTERM.

## 4. What the page may do (the trust boundary)

The desktop webview hands every frame everything `saucer.exposed` offers. The
bridge can't tell callers apart, which is why `pageTrust.h` controls what loads,
not who calls. Starting processes would be the most powerful thing exposed, so
the page names servers and never commands:

- **The folder is picked natively** (`pickFolder`), the way a file the page may
  read is one a picker returned. The page can't type a path into a server's
  configuration.
- **The page calls by id**: `localServers()`, `startServer(id)`,
  `stopServer(id)`, `restartServer(id)`, `serverLog(id)`, `setServerSettings(id, settings)`.
  There is no call that takes a command, an argument list or an interpreter
  path. The interpreter is picked natively too, when it isn't found.
- **Settings are a fixed list of variables**, checked natively. Arbitrary
  variables would run code: `NODE_OPTIONS=--require …`, `PYTHONSTARTUP`,
  `PYTHONPATH`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`. To start with:

  | Variable | Both | Notes |
  |---|---|---|
  | `ALLOWED_ORIGINS` | ✓ | default: unset, which already allows this machine's pages and the apps |
  | `ALLOWED_EMAILS` | ✓ | |
  | `COORDINATOR_ENABLED` | node | |
  | `HKP_INSTANCE` | node | which `~/.hkp/node-<instance>/` the server keeps its data in |
  | `HOST` | ✓ | `127.0.0.1` by default; anything else is confirmed natively, because it puts the server on the network |
  | the limits (`HKP_MAX_*`, `HKP_COORDINATOR_MAX_*`, `HKP_MIN_TIMER_INTERVAL_MS`) | as each server reads them | numbers only |

  **Never from the page:** `ALLOW_NO_AUTH`, the Auth0 settings, `HKP_EGRESS*`,
  `HKP_MOUNT_SECRET`, and the data directories (`HKP_DB_DIR`, `HKP_FILES_DIR`,
  `HKP_STORE_DIR`, `HKP_COORDINATOR_*_DIR`), which are paths on disk. A server
  that needs them gets them from its own `.env`, which the person edits
  themselves.
- What a compromised page could still do is start and stop the servers the
  person configured, and widen `ALLOWED_ORIGINS` or `ALLOWED_EMAILS` on them.
  Those still sit behind each server's authentication. Whether widening deserves
  a native confirmation is open below.

## 5. Finding `node` and `uv`

The fiddly part. An app started from the Finder (or a desktop launcher) doesn't
get the person's shell `PATH`, so a `node` from nvm, fnm or Homebrew, or `uv`
under `~/.local/bin`, isn't found by name.

- Look each up once through the person's login shell
  (`$SHELL -ilc 'command -v node'`), with a timeout, since an interactive shell
  may print or wait. Keep the path, and look again only when it stops existing.
- Run the server with that interpreter's directory first on `PATH`, so `npm`'s
  own children find the same `node`.
- When it isn't found, say so and offer the native picker for the binary.
- Windows: `where node`, and the same picker.

## 6. Kept as remotes

A server the app starts is kept as a remote automatically, with no step in
*Manage runtime servers*: hkp-node under `node`, hkp-python under `python` (the
shared names, `SHARED_REMOTE_NAMES` in `hkp-frontend/src/runtime/board/remote.ts`),
at the port the app gave it. Shipped
boards that say `"remote": "node"` then resolve as soon as the server is
running. When the person already keeps a remote under that name, they're asked
which one the name should mean, rather than having theirs replaced.

## 7. The page

A *Local servers* view in the desktop app, in its settings beside the runtime
servers:

- one row per configured server: kind, source (a version, or a folder), port,
  status dot, start, stop, restart;
- *Add server*: managed (pick the kind and the extras) or from a folder (the
  native picker);
- for a managed one, the version it runs, and the update when the manifest
  names a newer one;
- its settings as a form over the allowed variables, with "restart to apply"
  when they changed while it runs;
- its log, following new lines, with the exit reason on top when it stopped;
- a link to what the server itself says: its runtimes, and, for a coordinator,
  its boards, through the REST routes the servers already have.

Hidden on hosts that don't offer the calls (the web, iOS, Android), by checking
for them rather than for a platform.

---

## Order

1. **Supervisor + stdin-close exit**: configure by picked folder, start, stop,
   restart, status, log, stop on quit. macOS first, then Linux, then Windows.
   A folder first, because it needs nothing published.
2. **Settings and remotes**: the allowed variables, restart to apply, kept as
   `node` / `python`.
3. **Managed**: publish hkp-python, the shrinkwrap and the lock, the manifest
   and its check in the release job; then install, update and roll back in the
   app.
4. **Introspection**: the server's own view of itself, linked from its row.

Independent of all three and worth doing first: the `withCoordinator` and
`localOnly` scripts in `hkp-node/package.json` should stop narrowing
`ALLOWED_ORIGINS` to `localhost:8555`, since the default already allows this
machine's pages. And a refused origin should get a 403 that says why, rather
than falling through `cors` to the auth check's 401.

## Tests

- The supervisor's rules (the allowed variables, the command for each kind,
  path lookup parsing) in `meander/backend/tests/`, without saucer.
- Starting a real hkp-node from a test: running, port answers, stop takes the
  whole group, a crash of the parent (kill the test's helper process) takes the
  server with it through stdin.
- The page's calls refuse what isn't on the list: an unknown variable, a
  command, a path.
- `HKP_EXIT_ON_STDIN_CLOSE` in each server's own suite.
- Managed: installing a version from a local registry (`verdaccio`, a local
  package index) into a temporary app data folder, starting it, updating to a
  second version and rolling back; an install that fails leaves the running
  version alone.
- The manifest check fails on a version that isn't published.

## Open questions

- **Widening on a compromised page.** Should widening `ALLOWED_ORIGINS`
  (anything beyond this machine and the apps) or `HOST` always ask natively?
  `HOST` yes, as above. Origins: probably yes for `*`, otherwise no.
- **Several servers of one kind.** Two hkp-node instances (a coordinator and a
  plain runtime server) are sensible. Each needs its own port and
  `HKP_INSTANCE`, and only one can be `node`. Name the other after its folder?
- **hkp-rt standalone.** The app embeds hkp-rt in process already. A standalone
  one started this way is possible but has no case yet.
- **Restarting on exit.** Keep a crashed server down (and say why), or restart
  it with backoff? Down, to start with: a server that crashes on start would
  otherwise loop.
- **Which extras by default.** hkp-python without `llm` is quick to install;
  with it, it compiles. Offer the extras per server, off by default, and say
  what each adds (which services).
- **Prebuilt wheels.** Publishing `llama-cpp-python`-backed wheels per platform
  would spare the compile. Probably later.
- **One managed version per kind, or several.** One, to start with: the
  manifest's. A person who wants another version uses a folder.
- **Starting with the app.** Probably a per-server "start when Readymade opens"
  switch, off by default.
