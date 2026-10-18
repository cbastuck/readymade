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
| 4 | Hosted boards can reach private networks | open | | |
| 5 | Unbounded coordinator WebSocket payloads | open | | |
| 6 | The board document as untrusted input | open | | Also carries confining hkp-rt's `filesystem`, moved here from finding 1 (D4) and required. A board's unit references reaching any file through the desktop `readFile` are closed by finding 3 (P3) |
| 7 | Same-host reverse proxy and address-based trust | open | | |
| 8 | JWT checks differ across runtimes | open | | |
| 9 | Secret and session exposure at rest | open | | One leak found and closed 2026-10-18, outside the review: the sign-in token on runtime descriptors (see the finding). The proposal itself is untouched |
| 10 | Facade capabilities and remaining shared-host items | open | | |

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

### 5. Medium: unbounded coordinator WebSocket payloads

Evidence: `maxPayload: 0` in `hkp-node/src/server.ts` (bridge), `coordinator/join.ts`, and `coordinatorLinks.ts` disables the ws payload limit. `HKP_COORDINATOR_MAX_FRAME_BYTES` exists but is unset by default, and where set it is checked in the message handler (`coordinator/participants.ts`, `coordinator/session.ts`) — after `ws` has buffered the whole message — so it bounds what is processed, not what is allocated. Node runtime/service/timer quotas default to unlimited or unrestricted in `index.ts`.

Why lower than first ranked: every one of these sockets is authenticated before the upgrade, by token or ticket. It stays above low because a member — admitted by a board's list, not the server's allowlist — can open a bridge, and an authenticated tenant is still capable of exhausting a shared process.

Proposal: give `maxPayload` a finite ceiling at or above the frame limit, so the library refuses what the application would drop. Establish finite hosted defaults for frame size, in-flight requests, buffered outbound bytes, execution concurrency, connections, timers, storage and logs. Bound nested services too. Large binary/audio data should have a defined chunking/streaming contract. Bound parsing and reject malformed YAS/bridge frames before expensive allocation.

Required tests: oversize/truncated frames, notification floods, slow readers, disconnect during transfer, low quota enforcement, and another tenant remaining responsive. Run destructive load tests only in isolated disposable environments.

### 6. Medium, unverified: the board document as untrusted input

Boards are shared as files and links, and opening one builds its runtimes. Neither pass established what a board somebody else wrote can do before the person opening it has agreed to anything. A board naming the local runtime with a `filesystem` or `core-input` service is finding 1 without a browser in between. Secrets have a consent prompt and remembered grants; whether building runtimes on a local or named server has an equivalent was not checked.

Proposal: state the trust model for an opened board, then test it. Inventory what a board can cause on open, per host: runtimes created, services configured, requests sent, files touched, devices opened. Anything reaching the local machine or a credentialed server should be behind the same kind of consent secrets are.

Moved here from finding 1 (2026-10-09), and required rather than optional: hkp-rt's `filesystem` reads and writes whatever path it is configured with (`hkp-rt/lib/src/services/filesystem.h`). Confine it to roots the person chose, as hkp-node's is confined to tenant volumes.

Required tests: a hostile board opened in the playground, the desktop app and on mobile creates nothing on a local or remote runtime and sends nothing until consent is given.

### 7. Medium: a same-host reverse proxy defeats address-based trust

Evidence: hkp-rt decides that a caller is local from its source address (`callerAddress` in `hkp-rt/lib/src/http/server.cpp`). The front door carries the real address beside a secret, but any other proxy on the same host — nginx or Caddy in front of a standalone hkp-rt — makes every request a loopback one, and so trusted. hkp-node decides by bind address instead: `HOST=127.0.0.1` without Auth0 configured runs without authentication, which is equally open once a proxy forwards to it.

Status: read from code; no proxied deployment was run.

Proposal: treat a request carrying `X-Forwarded-For` or `Forwarded` as non-local unless the front door's secret accompanies it, and have a no-auth server refuse such requests. Say in the deployment docs that a loopback bind is a boundary only while nothing forwards to it.

### 8. Low–Medium: JWT checks differ across runtimes

Evidence: Node's `createJwtVerifier` passes `audience` to `jwt.verify`, but no expected `issuer` or explicit algorithm list. Python's `_verify_jwt` restricts RS256 and audience, but passes no issuer and requires no expiry claim. Node also does not explicitly require expiry. The Python signed-token tests intentionally accept tokens without `iss` or `exp`. PHP checks issuer/RS256/expiry; C++ explicitly checks issuer and RS256. The Node and Python calls were re-read in the second pass; PHP and C++ were not.

Why lower than first ranked: trusted JWKS keys still constrain signatures, and this is not evidence that arbitrary unsigned or attacker-signed tokens work. On Node, jsonwebtoken 9 derives the accepted algorithms from the key's type, so an RSA key is not usable for an HMAC token; expiry is enforced whenever the claim is present, and Auth0 always sets it; and the keys are one Auth0 tenant's, so a token they verify was issued by that tenant. What remains is consistency and defence in depth: fetching keys from a configured issuer does not validate the token's issuer claim, and an optional expiry check does not reject missing expiry.

Proposal: align issuer, audience, accepted algorithms, mandatory claims and token type across runtimes. Require nonempty subject and expiry; define clock skew and acceptance of multiple client audiences. Document the deliberate use of ID tokens as API credentials, or adopt API access tokens with explicit scopes.

Required tests: locally signed tokens against a controlled JWKS endpoint, covering valid tokens, wrong/missing issuer, wrong audience, absent/expired expiry, future not-before, invalid signatures, disallowed algorithms, key rotation and unverified email. Exercise real HTTP and WS entry points rather than replacing authentication with a principal resolver.

Reference: [JWT best current practices, RFC 8725](https://www.rfc-editor.org/info/rfc8725/).

### 9. Low–Medium: secret and session exposure at rest

Evidence: `meander/frontend/src/auth/session.ts` persists refresh and ID tokens in localStorage; desktop injects the whole vault; `plans/TODO-SECRETS.md` records plaintext vault persistence with restrictive file permissions. Audience-aware redirect handling in Node's `credentialedFetch.ts` is a positive existing control.

Why lower than first ranked: a plaintext file readable only by its owner is the posture of most developer credentials on a desktop. These stores matter mainly as what findings 1 and 3 would hand over, so fixing those does more for them than moving the storage does.

Proposal: move native refresh tokens and vault values into platform secure stores, minimize JS access, and define revocation/rotation for long-lived machine credentials. Add canary-secret assertions covering export, saved boards, member snapshots, logs, errors, notifications and Playwright artifacts. Test credential audience behavior across HTTPS downgrade, redirect chains, custom headers and body payloads; header protection alone is not a complete egress policy.

Reference: [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

**Closed 2026-10-18, found while testing, not by the review: the sign-in token on runtime descriptors.**

- **The leak.** Creating a runtime put the signed-in user onto its descriptor, ID token included (`core/runtimeOperations.ts`). A descriptor is spread into whatever exports a runtime, so the token travelled into three places:
  - a saved runtime file (`components/Runtime.tsx`, `onSaveRuntime`);
  - the runtime's Configure dialog;
  - what a custom runtime action sends to another runtime, possibly on another server (`RuntimeHeader.tsx`).
- **Not affected:** saved boards, Share as QR and deploying, which list each runtime's fields one by one.
- **The fix.** The descriptor no longer carries `user`. The REST runtime never read it; its scope is given the user separately (`authenticatedUser`). The only reader was the deprecated GraphQL runtime, which is now unauthenticated. The three outputs, and JSON applied in the runtime editor, drop a `user` read back from a file saved earlier (`withoutSession` in `types.ts`).
- **Tests:** `hkp-frontend/src/core/tests/runtimeSession.test.ts`.
- **Left:** a runtime file saved before the fix still holds a token, expired by now since an ID token lives for ten hours. The canary assertions this finding proposes would have caught the leak, and remain to be written.

### 10. Investigate: facade capabilities and remaining shared-host items

`coordinator/facadeAccess.ts` explicitly grants any payload to a facade-exposed process target. Hiding fields in the UI cannot enforce business rules. Test forged caller identity, arbitrary actions, nested addresses, unauthorized configuration, duplicate/replayed submissions, and projection of whole notifications. Member removal must invalidate existing sockets as well as new connections. Include public mount URLs and asset URLs in the capability/revocation inventory.

Smaller items from the second pass, none of them confirmed as exploitable:

- The desktop's frontend server binds `0.0.0.0:9090` whether or not external access is switched on (`meander/backend/main.cpp`). It serves static files, and `/serviceRedirect` is refused to callers off the machine — but a page in the user's browser is on it, so that route rests on the `state` value alone. Confirm `state` is checked, and decide whether "external access off" should mean nothing listens on the LAN.
- A browser's WebSocket carries its ID token as `?access_token=`, where proxies and access logs record it. Prefer a short-lived, single-use ticket for the handshake.
- `expression-eval` is the boundary between a board's expressions and the runtime's process (`hkp-node/src/services/expression.ts`, and the same library in the browser). Check that it is still maintained and has no open advisories; pin and review it like security code.

Also review filesystem/symlink boundaries, runtime plugin/model execution, public endpoint abuse, upload content types, TLS deployment and dependency vulnerabilities before declaring a shared-host product ready. These are investigation areas, not confirmed vulnerabilities from this review.

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
