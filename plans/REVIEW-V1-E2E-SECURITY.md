# Readymade v1: E2E and security review

Reviewed 2026-10-06 against the current working tree, including uncommitted changes. This is a targeted source review of E2E infrastructure, CI, runtime authentication, coordinator facade access, and desktop privilege boundaries. It is not a penetration test or a comprehensive dependency/native-platform audit. No application code was changed.

Revised 2026-10-09 after a second pass that checked each security finding against the code. The findings are reordered by severity: the loopback finding and the hosted-network one are raised, the WebSocket, JWT and secret-storage ones lowered, and two findings plus three smaller items added. The E2E sections were not re-checked, apart from the CI item, which a commit of the same day changed.

## Progress

The security findings are worked through one at a time, in the order of the table below. This table is the only record of where that work stands: a session picks up the first row that is not `done`, and needs nothing but this document to do so.

| # | Finding | State | Since | Outcome, or what is pending |
| --- | --- | --- | --- | --- |
| 1 | Local runtimes trust every loopback caller | in progress | 2026-10-09 | Built in all three runtime servers, the desktop host and the playground, with tests and docs. Remaining: the pass by hand listed under the finding |
| 2 | Prototype pollution in facade projection | open | | |
| 3 | Native page trust and navigation policy | open | | |
| 4 | Hosted boards can reach private networks | open | | |
| 5 | Unbounded coordinator WebSocket payloads | open | | |
| 6 | The board document as untrusted input | open | | Also carries confining hkp-rt's `filesystem`, moved here from finding 1 (D4) and required |
| 7 | Same-host reverse proxy and address-based trust | open | | |
| 8 | JWT checks differ across runtimes | open | | |
| 9 | Secret and session exposure at rest | open | | |
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

### 2. High: prototype pollution in facade projection, reaching identity

Evidence: `hkp-node/src/coordinator/facadeAccess.ts`, `readPath`, `writePath`, and `pick`. `writePath` traverses ordinary objects without rejecting special path segments or requiring own properties. A path beginning `__proto__` reaches `Object.prototype`. Only that segment works: a `constructor.prototype` path does not, because `isRecord` rejects the function and an own property is written instead.

Confirmed twice in isolation, through the real exported functions and with the probes removed afterwards. The first pass called `projectState` with source path `__proto__.readymadeReviewProbe`. The second pass used `readFacadeAccess` on a facade whose sources read `__proto__.email` and `__proto__.email_verified`, then `projectNotification` on a notification parsed from JSON carrying those keys. Afterwards `identityFromClaims` (`hkp-node/src/auth.ts`) returned `{ sub, email: "victim@example.com" }` for claims holding only a `sub`. The projection itself returned nothing, so the member is sent no frame and the write leaves no trace on the wire.

Reachability: projection runs only for member bridges (`deliverNotification`, `broadcastServiceState` and the member snapshot in `coordinator/session.ts`). The paths come from the facade an owner deploys, and the values from that board's service state or notifications. The actor is therefore somebody who passes `ALLOWED_EMAILS` and shares a board with a second account of their own — no other person is needed.

Consequence: every object in the coordinator process inherits the written value, for every tenant. `identityFromClaims` reads `email` and `email_verified` from parsed claims without requiring own properties, so a token from the same Auth0 tenant that carries no email claim would be identified as the polluted address: on the server's allowlist if that address is, and a member of every board shared with it. That last step was confirmed against the function, not against a running server with a real token. Separately, overwriting something like `Object.prototype.toString` breaks the process for everyone, and the `uncaughtException` handler in `index.ts` keeps it running in that state.

Proposal: reject `__proto__`, `constructor`, and `prototype` path segments; traverse own properties only; construct output maps without prototypes. Validate facade paths at ingestion and retain defensive checks at projection. Read identity claims as own properties only, so that a pollution elsewhere cannot become an identity. Add regression tests asserting Object.prototype is unchanged, including nested paths, arrays, and inherited state. Assess other path setters and merges using the same rule.

Reference: [OWASP prototype pollution prevention](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html).

### 3. High impact, conditional: native page trust is not enforced by navigation policy

Evidence: `meander/backend/main.cpp` accepts every permission request, allows every same-window navigation, injects the complete vault as `window.__HKP_VAULT__` at document creation, and exposes `readFile` and `writeFile` on caller-supplied paths plus secret and grant modification methods. Only new-window navigation is diverted to the system browser. `schemeHandler.cpp` also uses broad CORS headers. All confirmed by reading in the second pass.

The permission-handler comment assumes only trusted local pages load, but the navigation handler does not enforce that assumption. External navigation could place an untrusted document inside a privileged webview, and a `writeFile` to an arbitrary path is code execution as the user. Actual exposure of each bridge function and injection on each native engine still needs a real-host exploit test.

Why conditional: it needs a way to get foreign content into the webview first. A keyword search of `hkp-frontend/src` for raw-HTML and script-evaluation sinks found only `components/SandboxFrame.tsx`; that is a search, not an audit of every link and embed. The impact is total and the fix is cheap, so it stays in the first tier, behind the two findings that need no such step.

Proposal: allowlist exact app origins and routes; open external URLs in the system browser; enforce bridge caller/frame origin; deny privileges in remote documents and frames. Replace blanket permissions with origin- and capability-specific decisions. Gate file access through approved file handles/paths rather than unrestricted caller-supplied paths. Keep secrets behind native operations where practical, instead of injecting the entire vault.

Required tests: external same-window links, redirects, iframes, custom schemes and deep links cannot read vault data, call file operations, change grants, or acquire camera/microphone permission. Run these on actual native hosts.

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
