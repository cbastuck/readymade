# Readymade v1: E2E and security review

Reviewed 2026-10-06 against the current working tree, including uncommitted changes. This is a targeted source review of E2E infrastructure, CI, runtime authentication, coordinator facade access, and desktop privilege boundaries. It is not a penetration test or a comprehensive dependency/native-platform audit. No application code was changed.

Revised 2026-10-09 after a second pass that checked each security finding against the code. The findings are reordered by severity: the loopback finding and the hosted-network one are raised, the WebSocket, JWT and secret-storage ones lowered, and two findings plus three smaller items added. The E2E sections were not re-checked, apart from the CI item, which a commit of the same day changed.

## Progress

The security findings are worked through one at a time, in the order of the table below. This table is the only record of where that work stands: a session picks up the first row that is not `done`, and needs nothing but this document to do so.

| # | Finding | State | Since | Outcome, or what is pending |
| --- | --- | --- | --- | --- |
| 1 | Local runtimes trust every loopback caller | in progress | 2026-10-09 | Built in all three runtime servers, the desktop host and the playground, with tests and docs. Remaining: the pass by hand listed under the finding |
| 2 | Prototype pollution in facade projection | done | 2026-10-18 | Machinery path segments are refused at deploy and ignored in projection, projection reads own properties only, and identity reads own claims only; `docs/content/concepts/cloud-boards.md` |
| 3 | Native page trust and navigation policy | in progress | 2026-10-18 | Built in the desktop host with tests and docs. Remaining: the pass by hand listed under the finding |
| 4 | Hosted boards can reach private networks | in progress | 2026-10-18 | Built in hkp-node, hkp-python and hkp-rt, each with tests and a source scan; docs, READMEs and skills updated. Remaining: the pass by hand on a hosted server |
| 5 | Unbounded coordinator WebSocket payloads | done | 2026-10-19 | A 64 MiB frame limit that is never off, and a WebSocket ceiling above it on every coordinator connection in all three runtimes; `docs/content/concepts/cloud-boards.md` |
| 6 | The board document as untrusted input | open | | Also carries confining hkp-rt's `filesystem`, moved here from finding 1 (D4) and required. A board's unit references reaching any file through the desktop `readFile` are closed by finding 3 (P3) |
| 7 | Same-host reverse proxy and address-based trust | done | 2026-10-19 | A request carrying `Forwarded`, `X-Forwarded-For` or `X-Real-IP` is never let in for where it comes from, in all three runtimes; `docs/content/concepts/runtime.md` |
| 8 | JWT checks differ across runtimes | done | 2026-10-19 | RS256, issuer, audience, and a required expiry and subject in every runtime, as the website already checked; `docs/content/concepts/runtime.md` |
| 9 | Secret and session exposure at rest | in progress | 2026-10-19 | Canary-secret sweeps in all three runtimes, a deployed board and the browser services. Remaining: platform secure stores, decided to follow v1. Two token leaks closed outside the review (see the finding) |
| 10 | Facade capabilities and remaining shared-host items | in progress | 2026-10-19 | WebSocket tickets instead of `?access_token=`, `expression-eval` vendored, member reach pinned by tests; `/serviceRedirect` and member removal confirmed. Remaining: the mount and asset URL inventory, and the investigation areas |

States, in order: `open` — nothing beyond the finding; `proposed` — a fix is written under the finding and waits for a decision; `decided` — the decisions are recorded there and nothing is built; `in progress` — partly built, with what remains listed under the finding; `done`.

How a finding is kept while it moves:

- While it is `proposed`, `decided` or `in progress`, the finding carries one working subsection ("Proposed fix", then "Decided", then "Remaining") that is rewritten in place — never appended to.
- When it is `done`, the whole finding section is cut down to three things: what was changed, the tests that pin it, and what was deliberately left. The reasoning moves to the docs page the row names, and the row says in one line what the outcome was.
- A decision that moves work to another finding is recorded in both rows.

The E2E and test-infrastructure sections further down are not tracked here.

## Assessment

The project has substantial unit and integration coverage, including tenancy, mount claims, secrets, coordinator restart/reprovision, binary transport, and lifecycle tests. The E2E suite adds valuable checks for real UI behavior, block editing, browser SQL persistence, and coordinator deployment. Stable service UUID locators, touch-driven mobile interactions, failure traces, and expected-failure tracking are good foundations.

The main deficiency is coverage of boundaries: authenticated users across processes, real native bridges, persistence across process restarts, and distributed failure recovery. Adding hundreds of service-panel tests would provide less confidence than a small suite testing these boundaries.

The supplied architecture description says cloud persistence does not exist; the current code and plans include persisted coordinator boards, membership and sharing. Release scope and threat modeling should reflect the implemented system rather than the older description.

## Security findings and investigations

Ordered by severity after the second pass. Each finding says what was confirmed and how; "read from code" means no request was sent and nothing was exploited.

| # | Finding | Severity | First pass |
| --- | --- | --- | --- |
| 1 | Local runtimes trust every loopback caller | Highest | #4, "high priority investigation" |
| 2 | Prototype pollution in facade projection, reaching identity | High | #1, high |
| 3 | Native page trust is not enforced by navigation policy | High impact, conditional | #2, high |
| 4 | Hosted boards can reach private networks | Medium–High | part of #7, "investigate" |
| 5 | Unbounded coordinator WebSocket payloads | Medium | #5, high |
| 6 | The board document as untrusted input | Medium, unverified | new |
| 7 | A same-host reverse proxy defeats address-based trust | Medium | new |
| 8 | JWT checks differ across runtimes | Low–Medium | #3, high |
| 9 | Secret and session exposure at rest | Low–Medium | #6, "before v1" |
| 10 | Facade capabilities and remaining shared-host items | Investigate | rest of #7, plus new smaller items |

### 1. Highest: local runtimes trust every loopback caller

Evidence, desktop: `hkp-rt/lib/src/http/server.cpp`, `AuthMiddleware::before_handle` and `wsOnAccept`, let a request through whenever the server runs without auth or the caller's address is loopback — the second even in JWT mode, on the stated grounds that "a loopback-source request is necessarily this machine's own UI". `meander/backend/main.cpp` runs the embedded runtime without auth on its default loopback bind and passes `*` as allowed origins. A web page in the user's own browser is also a loopback caller, so the premise does not hold.

What that caller reaches: hkp-rt's `filesystem` service reads and writes whatever path it is configured with, with no confinement (`hkp-rt/lib/src/services/filesystem.h`), and `core-input` captures the microphone. Any site visited while Readymade is running could therefore build a runtime on `127.0.0.1:8887`, read or write the user's files and, where the app holds the permission, record audio and send it out.

Evidence, Node: `resolveServerAuthConfig` in `hkp-node/src/index.ts` permits no-auth on a loopback bind; `parseAllowedOrigins` defaults to `*`, HTTP CORS then reflects any origin, and `isOriginAllowed` admits any WebSocket origin. The reach is narrower than on the desktop — hkp-node's `filesystem` is confined to tenant volumes, and `hkp-node/src` contains no `eval`, `new Function` or `child_process` — but `http-client`, `smtp-email` and `sql` are all callable.

Status: read from code. No hostile-origin request was sent to a running runtime. Browser local-network protections (Chrome's permission prompt, mixed-content rules) reduce this for some users; they vary by browser and are not a control this project owns. Existing tests prove rejection when an explicit allowlist is supplied, not safe default behavior.

Proposal: make the default allowed origins the app's own rather than `*`. On control routes, refuse a request that carries a foreign `Origin` even when its source address is loopback, and validate `Host` to address DNS rebinding. Consider a per-launch capability token handed to the webview the way `__MEANDER_CONFIG__` is, so that being local is no longer sufficient. Independently, decide whether hkp-rt's `filesystem` should be confined to roots the user picked. Origin checks must protect control routes without breaking intentional public mounts or machine clients, which send no `Origin`.

Required tests: a hostile browser origin against actual loopback servers for both runtimes — simple requests, preflighted JSON, WebSocket upgrade and a rebinding `Host` — creating a runtime, configuring `filesystem` and reading a file must all fail.

#### Decided 2026-10-09, in progress

Checked while deciding: hkp-rt parses a request body whatever its `Content-Type` (`json::parse(req.body)` throughout `server.cpp`), so a `text/plain` POST from any page creates a runtime without a preflight. Narrowing the CORS header alone would hide responses and stop nothing; the refusal happens on the server. hkp-python has the same defaults as hkp-node and is in scope.

**The rule.** A request let in without a credential — a server in no-auth mode, or hkp-rt's loopback pass in JWT mode — is let in only when both hold:

- it does not come from a foreign page: its `Origin` is absent or on the server's origin list, and when `Origin` is absent its `Sec-Fetch-Site` is not `cross-site` (a browser omits `Origin` on a plain cross-site GET, but says so there);
- it addresses the server by a name the server knows: the `Host` is an IP literal, `localhost`, or the configured external host. A rebinding attack needs a name the attacker resolves, so this is what stops it.

It covers HTTP control routes and WebSocket upgrades alike. Mounts stay exempt — they are matched before it. A request carrying a verified token keeps its current treatment. A request a native host forwards in-process from its own webview (`Server::handleRequest`, the `hkp://` scheme) never crossed the network and is not subject to it.

**The origin list.** Unset, it is the origins Readymade's own apps run from — `saucer://embedded` (desktop), `hkp://app` (iOS), `https://appassets.androidplatform.net` (Android) — and any loopback origin, whatever its port (D2). The public website is not on it (D1). `ALLOWED_ORIGINS` replaces it with exactly what it names. `*` remains something an operator may write, and then applies to CORS headers and token-bearing requests only; for the rule above it reads as unset. The CORS header echoes the matched origin with `Vary: Origin`.

**The refusal.** `403` with no CORS headers and nothing in it that says why. To the page that was refused this is the same opaque network error a server that is not running produces — no status, nothing to read — and that is intended: a page is told nothing about what refused it. (That a port is open stays observable to a page that probes for it, as for any local server; not something this changes.)

A preflight is not where a page is refused. hkp-rt cannot answer one per origin — Crow answers `OPTIONS` before it has read the headers naming the page — so it answers every preflight alike, and the request that follows states its origin and is refused on it. The other runtimes may answer preflights per origin, but nothing may rest on that: the rule is applied to the request.

**Allowing a remote origin (D1)** is a change at the local end only:

- `ALLOWED_ORIGINS` for hkp-node, hkp-python and a standalone hkp-rt; for the desktop app an `allowedOrigins` list in `~/.hkp/settings.json`, editable in its settings dialog and applied without a restart.
- The page says what to do. When a board cannot reach a runtime server, the playground shows a dialog worded for both causes — the server is not running, or it does not allow this page's origin — naming the server and the origin, what to change locally for each kind of server, and a **Check again** button that repeats the connection and proceeds when it succeeds. It lives in hkp-frontend and is not specific to loopback.

**Left as it is.**

- D3 — no per-launch token for the desktop's port. `Origin` is enforced by browsers, so what remains after this fix is other processes and other accounts on the same machine.
- D4 — confining hkp-rt's `filesystem` is not part of this finding. Moved to finding 6, where it is required, not optional.

**Built 2026-10-09**, each with the hostile cases (foreign `Origin` on a simple POST, on preflighted JSON and on the upgrade; no `Origin` with `Sec-Fetch-Site: cross-site`; a foreign `Host`) and the callers that must keep working (no `Origin` at all, each app origin, a loopback origin, a mount):

- hkp-rt — the rule in `lib/include/origins.h`; `http/server.cpp` applies it in `AuthMiddleware` and `wsOnAccept` and states who may read an answer in one place (`CorsMiddleware`); `Server::allowOrigins` adds origins while running. Tests: `tests/origins.test.cpp`, `tests/server_origins.test.cpp`.
  Found by running the app, and fixed with it: a request the desktop host hands over in-process carries no middleware context, and `callerOfRequest` read a caller out of it — a crash on the first service configured from the app's own page. The read dates from the board-members work, not from this finding; `server_origins.test.cpp` now drives that path too.
- hkp-node — `src/origins.ts`; `server.ts` applies it ahead of everything that reads a request, and in the upgrade handler. Tests: `tests/origins.test.ts`, `tests/server-origins.test.ts`.
- hkp-python — `src/hkp/origins.py`; `server.py` applies it in the auth middleware and decides CORS per request (`aiohttp-cors`, which takes a fixed list, is gone). Tests: `tests/test_origins.py`.
- Desktop host — passes nothing instead of `*`, names the frontend server's LAN address, and keeps `allowedOrigins` in `~/.hkp/settings.json` (`backend/allowedOrigins.h`, `settings.h`, `schemeHandler.cpp`), handed to the running runtime as it is saved; Settings → Access → Allowed websites edits it. Tests: `backend/tests/allowedOrigins.test.cpp`.
- Playground dialog — `hkp-frontend/src/core/runtimeReach.ts` holds a runtime create request that got no answer and makes it again once told to; `ui-components/RuntimeUnreachableDialog.tsx` says both causes and checks again. One dialog per server, however many runtimes wait on it. Tests beside each.
- iOS — a development build names the origin of `DEV_WEBAPP_URL` (`HKPRuntimeHost.mm`). **Not compiled in the app**: `build-ios.sh` stops earlier, at its frontend type-check, on errors in files this did not touch (`Uint8Array` used as a generic), and the simulator build directory is stale. The lines were compiled and run on their own. Android already named its own origin.
- Docs — `docs/content/concepts/runtime.md` ("Who may call a server from a browser"), `docs/content/targets.md`, and the `ALLOWED_ORIGINS` rows of the three READMEs.

**Remaining.**

1. A pass by hand, which nothing above replaces — the tests send a browser's headers, they are not a browser on another site, and nothing was run in the packaged app:
   - from a page on another origin, against a running desktop app and a local hkp-node: nothing can be created or read, and the socket does not open;
   - the playground on the public website against a local runtime: the dialog appears, and Check again lets the board through once the site is allowed — in the app's settings without a restart, for a command-line server after one;
   - the packaged desktop app, and a phone on the LAN with external access on, still drive the runtime;
   - an iOS build at all, once `build-ios.sh` gets past its frontend step, and then a development build on a device.
2. Move what is settled here into the docs' own words where it is not yet, then cut this section down as the Progress rules say.

### 2. Done 2026-10-18: prototype pollution in facade projection, reaching identity

A facade source path through `__proto__` wrote into `Object.prototype` when it was projected for a member. From there `identityFromClaims` read a polluted email for any token that carried none. The reasoning is now in `docs/content/concepts/cloud-boards.md` ("A path names data").

**Changed.**

- `hkp-node/src/coordinator/facadeAccess.ts`: `isPlainPath` refuses the segments `__proto__`, `constructor` and `prototype`. `readFacadeAccess` grants nothing for such a path and lists it in `refused`. `readPath` reads own properties only. `writePath` writes no such path, and `pick` builds its objects without a prototype.
- `hkp-node/src/coordinator/router.ts`: deploying a board answers `400` naming the path when its facade has one anywhere, including in items kept for the owner (`refusedFacadePaths`). A board restored from the store does not pass through here; the projection's own checks cover it.
- `hkp-node/src/auth.ts`: `identityFromClaims` and `isEmailAllowed` read `sub`, `email` and `email_verified` as own claims only (`ownClaim`).
- `hkp-node/src/services/map.ts`: `mergeAtPath` was the same writer, reached from a template key a board names (`"__proto__.x"`). It now sets nothing for such a key.

**Tests.**

- `tests/board-members.test.ts`, "a facade path into what every object inherits", covers four things: the review's probe, after which `Object.prototype` and the identity of an email-less token are unchanged; own-property-only projection; the deploy refusal; and owner-only items.
- `tests/auth.test.ts`: claims that are only inherited are not read.
- `tests/map.test.ts`: such template keys set nothing.
- All six fail against the code before the fix.

**Left.**

- The read-only `valueAt` helpers in `conversations.ts`, `iterator.ts`, `queue.ts`, `store.ts` and `communication-dispatcher.ts` still follow inherited properties. They write nothing, so they cannot pollute; at worst a path such as `constructor` reads a function.
- A key `__proto__` with no dot, assigned directly (as in `map`), sets that one object's prototype, not the global one.
- The frontend's facade code was not reviewed for the same pattern. It runs in one person's browser, not in a shared process.

### 3. High impact, conditional: native page trust is not enforced by navigation policy

Evidence: `meander/backend/main.cpp` accepts every permission request, allows every same-window navigation, injects the complete vault as `window.__HKP_VAULT__` at document creation, and exposes `readFile` and `writeFile` on caller-supplied paths plus secret and grant modification methods. Only new-window navigation is diverted to the system browser. `schemeHandler.cpp` also uses broad CORS headers. All confirmed by reading in the second pass.

The permission-handler comment assumes only trusted local pages load, but the navigation handler does not enforce that assumption. External navigation could place an untrusted document inside a privileged webview, and a `writeFile` to an arbitrary path is code execution as the user. Actual exposure of each bridge function and injection on each native engine still needs a real-host exploit test.

Why conditional: it needs a way to get foreign content into the webview first. A keyword search of `hkp-frontend/src` for raw-HTML and script-evaluation sinks found only `components/SandboxFrame.tsx`; that is a search, not an audit of every link and embed. The impact is total and the fix is cheap, so it stays in the first tier, behind the two findings that need no such step.

Proposal: allowlist exact app origins and routes; open external URLs in the system browser; enforce bridge caller/frame origin; deny privileges in remote documents and frames. Replace blanket permissions with origin- and capability-specific decisions. Gate file access through approved file handles/paths rather than unrestricted caller-supplied paths. Keep secrets behind native operations where practical, instead of injecting the entire vault.

Required tests: external same-window links, redirects, iframes, custom schemes and deep links cannot read vault data, call file operations, change grants, or acquire camera/microphone permission. Run these on actual native hosts.

#### Decided 2026-10-18, in progress

Checked while deciding:

- **The bridge does not know who calls it.** saucer registers one WebKit message handler, and WebKit offers it to every frame. `didReceiveScriptMessage` (`saucer-src/src/wk.webview.impl.mm`) does not read `frameInfo`. So any document in the webview, at any depth, can call every exposed function. Without patching saucer, what loads is the boundary. The navigate handler sees iframe loads on WebKit. WebView2 hooks main-frame navigations only, but there a frame cannot post to the host unless the host subscribes to it, and saucer does not.
- **What already held.** The injected globals go to the main frame only (`script::no_frames`). A login comes back as a `postMessage` from the redirect relay, not as a navigation. The frontend's only iframe loads `/sandbox` on the app's own origin.
- **A board could read any file (finding 6).** Unit references resolve with `new URL(ref, base)`, so `../../..` or `file:///…` in a board read that file through `readFile`. So did `hkp://local-image/`, whose comment counted on `readFile` being open anyway.

**Decided.**

- **P1:** only the app's own pages load, at any depth.
- **P2:** permissions are granted for the microphone, the camera and location.
- **P3:** files: what was picked, plus what lies beside or below a picked file. A sibling folder is where it stops.
- **P4:** a dev build trusts the Vite server and the frontend server's LAN address.

**Built 2026-10-18.**

- `meander/backend/pageTrust.h`: `decideNavigation`, `mayGrantPermission` and `FileGrants`, which compares paths after `weakly_canonical`.
- `main.cpp` applies them:
  - the navigate handler loads own pages only. A web address the person clicked, or a new window, opens in their browser; anything else is refused and logged.
  - the permission handler applies `mayGrantPermission`;
  - the pickers grant what they return, through `fileUriToPath`, since the macOS picker answers with a `file://` URL;
  - `readFile` and `writeFile` check the grants;
  - the vault and grants injections run only when `location.protocol + '//' + location.host` is an own page.
- `schemeHandler.cpp`: `handleRequest` names the asking origin in `Access-Control-Allow-Origin` when it is an own page, and drops the header for any other origin. A request that names no origin is answered as before, because an engine need not hand a scheme handler one. `hkp://local-image/` checks the grants.
- Tests: `backend/tests/pageTrust.test.cpp`. It covers origins and lookalikes, every kind of navigation, permissions by origin and type, and file grants beside, below, `..`, sibling, symlinked out, and writes without a save pick. It passes with `meander/run-tests.sh` (66 of 66).
- The Debug app (embedded frontend) builds, and launched with nothing refused in its log. Only its log was read: another instance held both ports, and nothing was clicked.
- Docs: `docs/content/targets.md`, "Only the app's own pages, on the desktop".

**Left as it is.**

- Secret values are still injected rather than kept behind native calls. Moving them changes how every service resolves `{{secret.…}}`.
- `saveJSON` writes to its own save pick, as before.
- The iOS and Android hosts were not reviewed under this finding. Their webviews load `hkp://app` and `appassets.androidplatform.net`, and their navigation and bridge policies are unchecked.

**Remaining.**

1. A pass by hand in the packaged app, on macOS and on Windows and Linux where built:
   - the app's own page loads, boards run, and secrets resolve. This also confirms each engine states `saucer://embedded` as the scheme answer's origin, or names none;
   - a same-window link to another site opens in the browser. A page-driven `location` change, a redirect and an `<iframe>` to another site load nothing, and the log names each;
   - the camera, the microphone and location work for a board; a clipboard or notification request is refused;
   - opening a board and its units from disk, picking an image for the start page and saving through the save dialog still work. A board whose unit names `../elsewhere/x.hkpp` reports that unit missing;
   - a dev build (`MEANDER_USE_EMBEDDED_FRONTEND=OFF`) against Vite. This also compiles the dev branch of `ownPages`, which the Debug build did not.
2. Then cut this section down as the Progress rules say.

### 4. Medium–High: hosted boards can reach private networks

Evidence: HTTP clients and asset downloads intentionally access user-selected URLs. A keyword search of `hkp-node/src/services/http-client.ts`, `rss.ts`, `websocket-reader.ts`, `hkp-node/src/assets.ts` and `credentialedFetch.ts` found no check on where a request goes — no private-range, loopback or link-local refusal. The audience-aware handling in `credentialedFetch.ts` protects which host a credential is sent to, not which hosts may be reached. On a shared host any owner's board can therefore address loopback services, the host's private network and a cloud provider's metadata endpoint. The severity depends on where the server runs: high on a cloud instance with a role attached, lower elsewhere.

Proposal: decide explicitly whether hosted boards may access private networks, loopback and cloud metadata. If not, enforce policy at every redirect and resolved destination and preferably at the network layer. Local boards may legitimately need LAN access, so apply deployment-specific policy.

Required tests: literal private addresses, names resolving to them, redirects into them and rebinding between resolution and connection are refused on a hosted configuration and allowed on a local one.

#### Decided 2026-10-18, in progress

**Why in the code and not only in a firewall.** A firewall rule on the hosted process's user would cover every service and library, and is the backstop on hosts the operator controls. But this code runs on servers its authors do not control, some on platforms with no firewall to write a rule in. And a firewall sees one process: it cannot tell a board's HTTP Client from the server's own connections (the coordinator link, the token issuer's keys, one runtime calling another's mount on the same host, as the RSS radio's voice does).

**The rule (E1).** With `HKP_EGRESS=public`, a destination a board chose is reached only when every address its name resolves to is a public internet address. Unset, nothing changes: desktop, embedded and self-hosted servers keep their LAN.

- **Refused ranges:** `0.0.0.0/8`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `169.254.0.0/16`, `192.0.0.0/24`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`, `::`, `::1`, `fe80::/10`, `fc00::/7` and `ff00::/8`.
- **Addresses inside addresses:** `::ffff:0:0/96`, `64:ff9b::/96` and `2002::/16` carry an IPv4 address, and are judged by it.
- **Where it is checked:** on the resolved address, where the socket opens, so every redirect hop and a name rebinding between lookup and connect are covered too. A refusal says which address and why.

**The exceptions (E2).** `HKP_EGRESS_ALLOW` lists addresses or ranges that are reached anyway: an internal model server, for example. They are addresses, not names, so an allowed name cannot be repointed. There is no port: the check runs where a name is resolved, which knows no port.

**What is exempt (E3).** Connections the operator configured, not a board: the coordinator link, and fetching the token issuer's keys.

**Kept from being forgotten (E4).**
- A new service is covered without doing anything: in hkp-node every `fetch` goes through a dispatcher that checks, and in hkp-rt and hkp-python services resolve through the guard.
- Each runtime's tests scan its sources and fail on a raw network API used outside the guard, naming what to use instead. The exemptions are listed in that test, with their reasons.
- The scaffolding skills and `CLAUDE.md` say so.

**Order.**
1. hkp-node: `egress.ts`; the `undici` dispatcher, `undici@6` to match Node 22's built-in `fetch`; IMAP and SMTP connect to the checked address, with the name kept for TLS.
2. hkp-python: `egress.py` and a guarded `aiohttp` resolver.
3. hkp-rt: `egress.h`, replacing the plain `resolve` at each site a board can point somewhere.
4. Docs: a "Hosted servers" section in `docs/content/concepts/runtime.md` covering what to set and the firewall backstop.

**Built 2026-10-18: hkp-node.**

- `src/egress.ts` holds the ranges, `readEgressPolicy`, `isPublicAddress` and `mayReach`, and `setEgressPolicy`.
  - **Hosted:** `setEgressPolicy` installs an `undici` (6.x) dispatcher as the process's. Its connector refuses an address literal itself, since a socket opened to one is never looked up, and resolves names through `egressLookup`, which refuses a name when any of its addresses is private. `index.ts` applies `HKP_EGRESS` before the server starts.
  - **Open:** undici is not even loaded, so nothing changes.
- **IMAP and SMTP** connect to `reachableAddress(host)`, the checked address, with the name passed as `servername` for TLS.
- **Error reports:** `http-client`, `rss`, `text-generation`, IMAP and SMTP say "This server does not reach private addresses (…)". Before, it was "fetch failed", or, for text generation, advice to start a model server.
- **Tests:**
  - `tests/egress.test.ts`: the ranges and their edges; IPv6 forms carrying an IPv4 address; literal, named and re-spelled private addresses refused through `fetch`; the allowlist; a redirect refused at its second hop, through `fetch` and through `fetchWithCredentials`; an open server unchanged.
  - Hosted cases in `tests/imap-email.test.ts` and `tests/smtp-email.test.ts`.
  - `tests/egress-sources.test.ts`, the source scan, with the coordinator link as its one exemption. Checked by adding a service calling `https.get`, which it reported.
- **Docs:** `HKP_EGRESS` and `HKP_EGRESS_ALLOW` rows in `hkp-node/README.md`; the rule in `/new-node-service`.

**Built 2026-10-18: hkp-python.**

- `src/hkp/egress.py` holds the same ranges and policy, applied by `__main__.py`. It offers two ways to make a request:
  - **`client_session()`** for aiohttp. Hosted, its connector checks every address `TCPConnector._resolve_host` returns. aiohttp sends both names and literals through that method, for every connection and redirect hop, and itself refuses legacy IPv4 spellings. The method is private, so `tests/test_egress.py` pins it: renaming the override fails three tests.
  - **`urlopen()`** for urllib. Hosted, each connection resolves through the check and opens to the address that was checked, via `http.client`'s `_create_connection` hook. TLS is still verified against the name.
- **Where they are used:** `http_client` uses `client_session()`; `assets` and `text_generation` use `urlopen()`. A refusal is reported as one, including where `text_generation` would otherwise say to start a model server.
- **Tests:**
  - `tests/test_egress.py`: the same address table as hkp-node; the policy; refusal, the allowlist and a redirect refused at its second hop, through aiohttp and through urllib; an open server unchanged; the HTTP Client's error message.
  - `tests/test_egress_sources.py`, the source scan. Its exemptions are the coordinator link and the text-to-speech model download, which comes from a fixed release address. Checked by adding a service opening its own `ClientSession`, which it reported.
- **Docs:** README rows.

**Built 2026-10-18: hkp-rt.**

- `lib/include/egress.h` holds the same ranges and policy, plus `egress::resolve` and `egress::asyncResolve`. They refuse when any endpoint the resolver answers may not be reached, and the caller connects to exactly those endpoints. An address literal resolves to itself and is judged the same way.
  - **The eight sites using them:** `http_client.cpp` (twice), `assets.cpp`, `text_generation.cpp`, `speech_http.h` (text-to-speech and speech-to-text servers), `websocket_client_session.cpp`, `receiver_session.h` (websocket-reader) and `websocket_writer.cpp`.
  - **How a refusal reaches the person:** `egress::Refused` carries the message, and text generation reports it instead of its "start a server" hint. The async path answers with an `hkp.egress` error code, which the WebSocket writer shows as its status.
- **Configuration:** `standalone_config.h` reads `HKP_EGRESS` and `HKP_EGRESS_ALLOW`, refusing to start on a setting it does not understand. `exe/main.cpp` applies the policy. The desktop app's embedded runtime never sets it, so it stays open.
- **Tests:**
  - `tests/egress.test.cpp`: the address table, the policy and its environment variables, sync and async refusal, the allowlist, and an open server unchanged.
  - `tests/egress_sources.test.cpp`, the source scan, matching resolver calls and `getaddrinfo`. Its exemptions are the coordinator link and the token issuer's keys. Checked by adding a file with its own `resolver.resolve`, which it reported.
  - All 368 hkp-rt tests pass, and the desktop app still builds.
- **Docs:**
  - "Where a hosted server may connect" in `docs/content/concepts/runtime.md`: the rule, the allowlist, what is exempt, and the firewall backstop, with what a firewall rule has to leave open.
  - Rows in `hkp-rt/README-docker.md`.
  - The rule in `/new-cpp-service`, and a line in `CLAUDE.md`'s service section.

**Remaining.**

1. A pass by hand on a hosted server, for each runtime that serves others:
   - an HTTP Client pointed at `http://169.254.169.254/` and at the server's own private address is refused, with the message;
   - a public URL still works;
   - a board using an allowed internal address still works.
2. Then cut this section down as the Progress rules say.

### 5. Done 2026-10-19: unbounded coordinator WebSocket payloads

**Changed.**

- `hkp-node/src/coordinator/frameLimits.ts`: the frame limit, 64 MiB unless `HKP_COORDINATOR_MAX_FRAME_BYTES` says otherwise, and never off. A frame over it is still dropped and logged, the connection kept.
- The WebSocket library's own ceiling, the frame limit plus 16 MiB for an introduction, replaces `maxPayload: 0` on the coordinator's join and bridge sockets and this server's links out (`join.ts`, `server.ts`, `coordinatorLinks.ts`).
- The same ceiling, read from the same setting, on hkp-python's link (`coordinator_links.py`) and hkp-rt's (`LinkSocket::Options::maxMessageBytes`, set in `coordinator_links.cpp`).
- Bridge and runtime sockets got an `error` listener in their upgrade callback. Without one, the library's report of an oversized frame would have ended the process.

**Tests.**

- `hkp-node/tests/coordinator-frame-limits.test.ts`: the limit is never off; an admitted bridge sending past the ceiling is closed with 1009; a link refuses such a frame from a coordinator.
- `hkp-python/tests/test_coordinator_links.py`: the link's ceiling.
- `hkp-rt/tests/link_socket.test.cpp`: a message past the ceiling closes the link.

**Left.** Runtime, service and timer quotas stay opt-in (decided 2026-10-19); `hkp-node/README.md` lists them. A chunking contract for large binary values, and bounds on nested services, were not taken up.

### 6. Medium, unverified: the board document as untrusted input

Boards are shared as files and links, and opening one builds its runtimes. Neither pass established what a board somebody else wrote can do before the person opening it has agreed to anything. A board naming the local runtime with a `filesystem` or `core-input` service is finding 1 without a browser in between. Secrets have a consent prompt and remembered grants; whether building runtimes on a local or named server has an equivalent was not checked.

Proposal: state the trust model for an opened board, then test it. Inventory what a board can cause on open, per host: runtimes created, services configured, requests sent, files touched, devices opened. Anything reaching the local machine or a credentialed server should be behind the same kind of consent secrets are.

Moved here from finding 1 (2026-10-09), and required rather than optional: hkp-rt's `filesystem` reads and writes whatever path it is configured with (`hkp-rt/lib/src/services/filesystem.h`). Confine it to roots the person chose, as hkp-node's is confined to tenant volumes.

Required tests: a hostile board opened in the playground, the desktop app and on mobile creates nothing on a local or remote runtime and sends nothing until consent is given.

### 7. Done 2026-10-19: a same-host reverse proxy defeats address-based trust

**Changed.** A request carrying `Forwarded`, `X-Forwarded-For` or `X-Real-IP` is never admitted without a credential: `admitsWithoutCredential` refuses it in hkp-node (`origins.ts`), hkp-python (`origins.py`) and hkp-rt (`origins.h`). In hkp-rt, `callerAddress` also treats it as from nowhere, so the loopback pass in JWT mode does not apply. Mounts are unaffected.

**Tests.** The rule in `tests/origins.test.ts`, `tests/test_origins.py` and `tests/origins.test.cpp`; against real servers in `tests/server-origins.test.ts`, `tests/test_origins.py` and `tests/server_origins.test.cpp`, over HTTP and the WebSocket upgrade, and for hkp-rt in JWT mode.

**Left.** A proxy that adds none of these headers cannot be told apart. `docs/content/concepts/runtime.md` and `hkp-rt/README-docker.md` say a loopback bind is a boundary only while nothing forwards to it.

### 8. Done 2026-10-19: JWT checks differ across runtimes

**Changed.** Every runtime now checks what the website's `auth.php` already did:
- RS256 only;
- the issuer `https://<AUTH0_DOMAIN>/`;
- an accepted audience;
- `exp` and a non-empty `sub` that must be present;
- `nbf` honoured, with 60 s of skew.

Per runtime:
- hkp-node (`auth.ts`) gained the issuer, the algorithm list and a required `exp`, plus `jwksUri` so keys can come from elsewhere.
- hkp-python (`auth.py`) gained the issuer and required claims.
- hkp-rt (`http/auth.cpp`) gained the required `exp` and `sub`. An issuer with no audiences now accepts nothing, where it used to skip the check.

**Tests.**
- hkp-node `tests/auth-jwt.test.ts`: tokens signed against a key set served from a local endpoint, through the real fetch path and an HTTP route.
- hkp-python `tests/test_auth.py`: its helper now mints realistic tokens.
- hkp-rt `tests/auth.test.cpp`.

Each covers a missing or past expiry, a future `nbf`, a wrong or missing issuer, a wrong audience, a missing subject, another key and HS256.

**Left.** ID tokens are still the API credential; Auth0 access tokens with scopes were not adopted. The website's PHP is unchanged and allows no clock skew.

### 9. Low–Medium: secret and session exposure at rest

Evidence: `meander/frontend/src/auth/session.ts` persists refresh and ID tokens in localStorage; desktop injects the whole vault; `plans/TODO-SECRETS.md` records plaintext vault persistence with restrictive file permissions. Audience-aware redirect handling in Node's `credentialedFetch.ts` is a positive existing control.

Why lower than first ranked: a plaintext file readable only by its owner is the posture of most developer credentials on a desktop. These stores matter mainly as what findings 1 and 3 would hand over, so fixing those does more for them than moving the storage does.

Proposal: move native refresh tokens and vault values into platform secure stores, minimize JS access, and define revocation/rotation for long-lived machine credentials. Add canary-secret assertions covering export, saved boards, member snapshots, logs, errors, notifications and Playwright artifacts. Test credential audience behavior across HTTPS downgrade, redirect chains, custom headers and body payloads; header protection alone is not a complete egress policy.

Reference: [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

**Built 2026-10-19: canary sweeps.** A secret with a recognisable value is used, the use is made to fail, and every surface is read for the value. Each sweep also asserts the value really was sent upstream.
- hkp-node `tests/secret-canary.test.ts`:
  - the runtime server: the run's answer, the runtime routes, the notification socket and the console;
  - a deployed board: what the owner's browser is told, the board's log, what the coordinator saves and holds, and the console.
- hkp-python `tests/test_secret_canary.py` and hkp-rt `tests/secret_canary.test.cpp`: the runtime server, its log and its console.
- hkp-frontend `runtime/browser/services/tests/secret-canary.test.ts`: HTTP Client, OpenAI Prompt and Workflow Board Builder — what each reports, says, answers and logs. Encrypt, Decrypt, Sign and the GitHub service already had such tests.

No leak was found.

**Closed 2026-10-18, found while testing, not by the review: the sign-in token on runtime descriptors.**

- **The leak.** Creating a runtime put the signed-in user onto its descriptor, ID token included (`core/runtimeOperations.ts`). A descriptor is spread into whatever exports a runtime, so the token travelled into three places:
  - a saved runtime file (`components/Runtime.tsx`, `onSaveRuntime`);
  - the runtime's Configure dialog;
  - what a custom runtime action sends to another runtime, possibly on another server (`RuntimeHeader.tsx`).
- **Not affected:** saved boards, Share as QR and deploying, which list each runtime's fields one by one.
- **The fix.** The descriptor no longer carries `user`. The REST runtime never read it; its scope is given the user separately (`authenticatedUser`). The only reader was the deprecated GraphQL runtime, which is now unauthenticated. The three outputs, and JSON applied in the runtime editor, drop a `user` read back from a file saved earlier (`withoutSession` in `types.ts`).
- **Tests:** `hkp-frontend/src/core/tests/runtimeSession.test.ts`.
- **Left:** a runtime file saved before the fix still holds a token, expired by now since an ID token lives for ten hours.

Also closed on `main` (commit `72c7a55c`, 2026-10-18), outside the review: the ID token is no longer sent to third-party URLs (`views/playground/common.ts`).

**Remaining.**

1. Platform secure stores for the native refresh token and the vault. Decided 2026-10-19 to follow v1; there is no keychain code on any platform yet.
2. Canaries in Playwright artifacts, and the credential-audience cases (HTTPS downgrade, redirect chains, body payloads).

### 10. Investigate: facade capabilities and remaining shared-host items

`coordinator/facadeAccess.ts` explicitly grants any payload to a facade-exposed process target. Hiding fields in the UI cannot enforce business rules.

**Settled 2026-10-19.**

- **What a member may send is pinned** in `hkp-node/tests/board-members.test.ts`:
  - their own identity, whatever the payload claims;
  - process calls only at the facade's targets, named exactly — a nested address or a near miss is refused;
  - the runtime is the board's to choose, not the message's;
  - never a configure;
  - a rate bound;
  - projection of state and notifications;
  - their bridges close the moment they are removed (`evictMember`).
  
  Replayed submissions are ordinary calls and count against the rate bound.
- **`/serviceRedirect`:** a relayed redirect reaches only the login waiting on the same `state`, and the PKCE verifier never leaves the webview. The frontend server keeps binding `0.0.0.0` (decided 2026-10-19).
- **WebSocket tickets.** `POST /ws-tickets` mints a single-use ticket, good for 30 s, bound to who the token named and whether they may own. It exists in hkp-node (`wsTickets.ts`, coordinator bridge included), hkp-python (`ws_tickets.py`) and hkp-rt (`http/ws_tickets.h`).
  - The browser opens its runtime sockets and the bridge with `?ticket=` (`runtime/rest/wsTicket.ts`).
  - `?access_token=` is still accepted from older clients, and the browser falls back to it only on a 404 or 405.
  - Tests: hkp-node `tests/auth-jwt.test.ts` (and every bridge in the cloud tests now opens with one), hkp-python `tests/test_auth.py`, hkp-rt `tests/server_origins.test.cpp`, hkp-frontend `runtime/rest/tests/ws-ticket.test.ts`.
- **`expression-eval`.** No advisories, but deprecated and unmaintained. It is vendored as `hkp-node/src/expressionEval.ts`, with an identical twin in `hkp-frontend/.../base/expressionEval.ts`, on `jsep` pinned at 0.3.5.
  - `constructor`, `prototype` and every `__` member are refused by name, and identifiers resolve to the scope's own properties only.
  - Tests: `tests/expression-eval.test.ts` in both. The old regex looked anchored but wasn't.

**Remaining.**

1. Inventory public mount and asset URLs as capabilities: who holds them, and how one is revoked (renaming a mount, rotating `HKP_MOUNT_SECRET`).
2. `hkp-frontend/src/runtime/browser/services/base/bundle.js` is an old browserify bundle nothing imports. Delete it or say why it stays.
3. The investigation areas, before declaring a shared-host product ready: runtime plugin and model execution, public endpoint abuse, upload content types, TLS deployment and a dependency audit. hkp-rt's file boundaries are under finding 6; hkp-node's volumes and hkp-python were not re-checked.

## E2E coverage proposals

| Priority | Journey | Acceptance criteria |
| --- | --- | --- |
| P0 | Authenticated owner/member/stranger | Owner deploys, member uses facade, stranger is denied; API/WS requests cannot bypass the UI; member removal disconnects/restricts an existing session. |
| P0 | Secret consent and egress | Denial sends no secret; approval sends only permitted aliases to the permitted runtime; audience mismatch blocks disclosure; export/log/member views contain no canary values. |
| P0 | Board lifecycle | Create in UI, add/reorder/configure/nest, run, save, close, reopen, edit and delete; resulting descriptor and behavior agree. Include import/export. |
| P0 | Distributed data flow | Browser → Node → Python/C++ emits known output and correlation ID; JSON, text, binary and MixedData preserve meaning; null stops and early return skips correctly. |
| P0 | Persistent deployment and recovery | Board state and records survive coordinator/runtime restart; participant reconnect does not duplicate services, timers, mounts or outputs; crash during deploy can be retried safely. |
| P1 | Multi-user data integrity | Two real browser contexts book the same resource concurrently; exactly one succeeds; trusted caller identity reaches the service; each user sees consistent state. |
| P1 | Native bridge and mobile | Real file save/open/cancel, keychain/session restore, custom schemes, share/deep-link handling and denied media permission. Add Android Chromium/touch profile and device checks. |
| P1 | Offline/error recovery | Network drops during configure/save/process, refresh fails, runtime disappears, storage is unavailable; UI reports a useful failure and retries without duplicate effects. |
| P1 | Composition lifecycle | Nested Switch/Tracks/SubService/block use processes correctly after rename/reorder/wrap/detach, and closing/replacing a board stops timers, sockets and media. |
| P2 | Accessibility and capability boards | Keyboard navigation, focus and labels; representative facade on mobile; deterministic camera/audio fixture journeys and actual peer-board pairing. |

Existing lower-level tests already cover many individual pieces. The proposal is to connect those pieces through a few real-user journeys, not replicate every unit assertion in Playwright. The plain WebRTC capability probe is useful, but does not prove a Readymade multi-user board works.

## Improve the test infrastructure

1. **Make E2E a release gate.** Since 2026-10-09 `.github/workflows/run-all-tests.yml` has an `e2e` job: the default Playwright configuration on Chromium and WebKit, lockfile installs, and the report and traces uploaded on failure. What remains: the workflow triggers on main pushes and manual dispatch, not pull requests; the cloud configuration (`test:cloud`) is not run; the job checks out without submodules; and `run-all-tests.sh` still omits E2E. Add PR jobs for fast browser tests and runtime integration, a scheduled native/cross-runtime suite, and a mandatory release suite. Check out submodules and their pinned commits correctly. Give the uploaded reports and traces controlled access and retention.
2. **Test production bundles.** Current configurations start Vite development servers. Keep this for fast local work, but run a release lane against built assets and packaged runtimes to catch packaging, routes, CSP and asset-loading differences.
3. **Add an authenticated cloud configuration.** Existing cloud tests explicitly clear Auth0 config and use unsigned frontend tokens. Keep that fast lane; add a controlled signing/JWKS fixture with real verifier paths and separate owner/member contexts. Keep one small staging identity-provider login smoke test for actual Auth0/PKCE configuration.
4. **Close the fake-host contract gap.** README correctly admits changed native routes can leave E2E green. Run conformance checks against actual native routes/exposed methods, followed by one packaged-app smoke journey per supported platform. The fake can remain the fast default.
5. **Fix reload seeding.** `seedBoard` writes localStorage and the fake host on every document initialization; fake-host state is also recreated on each document. This can overwrite saved changes and does not prove native persistence. Seed once per test storage origin; make persistence journeys reopen without reseeding, and assert the edited value rather than the original fixture.
6. **Replace arbitrary waits.** Draft and rename specs use multi-second `waitForTimeout`. Poll stored state or a visible saved indicator; use an explicit observable idle condition for debounced operations. Negative timing assertions, such as notification deduplication, may legitimately need a bounded observation interval.
7. **Centralize failures and cleanup.** Register page errors and relevant console errors before navigation, attach unexpected request failures and runtime logs, and use a small reviewed allowlist for intended permission/network failures. Stop boards and delete test state even on failed assertions. Assert cleanup responses. Give each test unique names and disposable data directories; do not always disable persistence when persistence is the feature under test.
8. **Make skipped coverage visible.** C++ deployment skips without a binary; face detection skips without a video; many listed desktop/mobile cases skip at runtime. Required release jobs should fail when a required binary/device fixture is missing. Publish executed/skipped/expected-failure counts by capability. A discovered count is not a coverage metric.
9. **Strengthen the board sweep.** It currently checks only top-level browser service frames, excludes remote boards, and keeps Reduce as expected broken. Add static validation for registries, nested pipelines, block expansion and facade references across all boards. For a small representative set, assert meaningful output. Retire or fix known broken shipped examples before release.
10. **Measure flakes.** Retain retry metadata and make repeated retry-only successes actionable. Pin environmental inputs, isolate external calls, use representative deterministic fixtures, and improve ambiguous `.first()` text locators where a scoped role/UUID is available.

## Suggested sequence

First close the local runtimes to foreign origins (finding 1), fix prototype pollution (2), enforce native page trust (3), and decide the hosted network policy (4). Add regressions with each fix. Settle what an opened board may do before consent (6) alongside finding 1, since the two share a fix. The payload ceiling (5) and the proxy rule (7) are small and can follow; JWT alignment (8) and secure storage (9) are hardening and need not block v1. In parallel with ordinary implementation work, establish PR E2E execution and the authenticated test harness.

Then add the owner/member/stranger journey, secret-consent journey and one persisted distributed restart journey. Those three tests exercise the most consequential v1 boundaries. Follow with packaged native smoke tests and a smaller Android/mobile facade suite.

Define release acceptance as named journeys actually executed and passing, no unexplained required skips, no cross-tenant disclosure, and recovery without duplicate side effects. Keep optional hardware/provider cases clearly separated.

## Verification performed

- Inspected E2E configs/support/specs, the CI workflow and aggregate test script; reviewed selected runtime/coordinator auth, facade projection, credential redirect handling and desktop bridge/navigation code.
- Playwright test discovery completed: 130 cases across 10 files in the default configuration, including profile instances that are later skipped. Cloud uses a separate configuration.
- Reproduced facade prototype pollution through the actual exported function in an isolated Node process and removed the probe property.
- Second pass, 2026-10-09: re-read the code behind every security finding — facade projection and its callers in the coordinator session, the Node and Python JWT verifiers, origin and auth resolution in hkp-node, the hkp-rt auth middleware and `filesystem` service, and the desktop host's bridge, navigation and frontend server. Ran one further isolated probe through the real `readFacadeAccess`, `projectNotification` and `identityFromClaims`, which showed projection pollution turning into an email on a token without one; the probe removed its properties. Keyword searches, not audits, stand behind the statements that hkp-node has no code-execution primitive, that its outbound services filter no destinations, and that the frontend has one raw-HTML sink.
- Not done in either pass: no request was sent to a running runtime from a hostile origin, no proxied or hosted deployment was exercised, the board-open consent path was not read, and the PHP and C++ JWT checks were not re-read.
- Did not run the complete browser/native/cloud suites, attack a deployed system, or perform a dependency vulnerability audit. No claim of a green baseline or a complete security assessment is made.
