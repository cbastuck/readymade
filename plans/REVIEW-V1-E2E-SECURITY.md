# Readymade v1: E2E and security review

Reviewed 2026-10-06 against the current working tree, including uncommitted changes. This is a targeted source review of E2E infrastructure, CI, runtime authentication, coordinator facade access, and desktop privilege boundaries. It is not a penetration test or a comprehensive dependency/native-platform audit. No application code was changed.

Revised 2026-10-09 after a second pass that checked each security finding against the code. The findings are reordered by severity: the loopback finding and the hosted-network one are raised, the WebSocket, JWT and secret-storage ones lowered, and two findings plus three smaller items added. The E2E sections were not re-checked, apart from the CI item, which a commit of the same day changed.

## Progress

The security findings are worked through one at a time, in the order of the table below. This table is the record of where that work stands: a session picks up the first row that is not `done`. A finding that is not done is kept outside this repository, as `plans/README.md` says of security weaknesses not yet fixed, and comes back here as its write-up once it is.

| # | Finding | State | Since | Outcome, or what is pending |
| --- | --- | --- | --- | --- |
| 1 | Local runtimes trust every loopback caller | done | 2026-11-08 | A request without a credential is let in only from no foreign page and for a host the server knows, in all three runtime servers and the desktop host; the playground says why a server refuses; `docs/content/concepts/runtime.md` |
| 2 | Prototype pollution in facade projection | done | 2026-10-18 | Machinery path segments are refused at deploy and ignored in projection, projection reads own properties only, and identity reads own claims only; `docs/content/concepts/cloud-boards.md` |
| 3 | Native page trust and navigation policy | done | 2026-11-08 | The desktop webview loads only the app's own pages, grants the microphone, camera and location only, and files only from what was picked; `docs/content/targets.md` |
| 4 | Hosted boards can reach private networks | done | 2026-11-08 | With `HKP_EGRESS=public`, a board reaches public addresses only, checked where the socket opens, in all three runtimes, with source scans; `docs/content/concepts/runtime.md` |
| 5 | Unbounded coordinator WebSocket payloads | done | 2026-10-19 | A 64 MiB frame limit that is never off, and a WebSocket ceiling above it on every coordinator connection in all three runtimes; `docs/content/concepts/cloud-boards.md` |
| 6 | The board document as untrusted input | in progress | 2026-10-18 | Kept outside this repository until done |
| 7 | Same-host reverse proxy and address-based trust | done | 2026-10-19 | A request carrying `Forwarded`, `X-Forwarded-For` or `X-Real-IP` is never let in for where it comes from, in all three runtimes; `docs/content/concepts/runtime.md` |
| 8 | JWT checks differ across runtimes | done | 2026-10-19 | RS256, issuer, audience, and a required expiry and subject in every runtime, as the website already checked; `docs/content/concepts/runtime.md` |
| 9 | Secret and session exposure at rest | in progress | 2026-10-19 | Kept outside this repository until done |
| 10 | Facade capabilities and remaining shared-host items | in progress | 2026-10-19 | Kept outside this repository until done |

States, in order: `open` — nothing beyond the finding; `proposed` — a fix is written under the finding and waits for a decision; `decided` — the decisions are recorded there and nothing is built; `in progress` — partly built, with what remains listed under the finding; `done`.

How a finding is kept while it moves:

- While it is `proposed`, `decided` or `in progress`, the finding — in the copy kept outside this repository — carries one working subsection ("Proposed fix", then "Decided", then "Remaining") that is rewritten in place — never appended to.
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

### 1. Done 2026-11-08: local runtimes trusted every loopback caller

A web page in the person's own browser is a loopback caller too, so being local was never proof of being the app. The rule is now in `docs/content/concepts/runtime.md` ("Who may call a server from a browser").

**Changed.**

- A request let in without a credential — a server in no-auth mode, or hkp-rt's loopback pass in JWT mode — is let in only when it does not come from a foreign page (its `Origin` is absent or on the server's list, and without an `Origin` its `Sec-Fetch-Site` is not `cross-site`) and it names the server by a host the server knows. HTTP control routes and WebSocket upgrades alike; mounts and in-process requests from a native host's own webview are exempt. A refusal is a bare `403` with no CORS headers.
- The origin list defaults to the apps' own origins and any loopback origin; `ALLOWED_ORIGINS` replaces it, and `*` no longer admits anyone without a credential.
- hkp-rt: `lib/include/origins.h`, applied in `http/server.cpp` (`AuthMiddleware`, `wsOnAccept`, `CorsMiddleware`); `Server::allowOrigins` adds origins while running.
- hkp-node: `src/origins.ts`, applied in `server.ts` ahead of everything that reads a request, and in the upgrade handler.
- hkp-python: `src/hkp/origins.py`, applied in `server.py`; CORS is decided per request.
- Desktop host: no `*`; `allowedOrigins` in `~/.hkp/settings.json`, edited under Settings → Access → Allowed websites and applied without a restart (`backend/allowedOrigins.h`, `settings.h`, `schemeHandler.cpp`).
- Playground: `core/runtimeReach.ts` and `ui-components/RuntimeUnreachableDialog.tsx` say why a runtime server cannot be reached — not running, or not allowing this page — and check again.
- iOS names the origin of `DEV_WEBAPP_URL` in a development build (`HKPRuntimeHost.mm`).

**Tests.** `hkp-rt/tests/origins.test.cpp` and `server_origins.test.cpp` (including the in-process path the desktop host uses), `hkp-node/tests/origins.test.ts` and `server-origins.test.ts`, `hkp-python/tests/test_origins.py`, `meander/backend/tests/allowedOrigins.test.cpp`, and tests beside the playground's reach code and dialog. Each covers a foreign `Origin` on a simple POST, on preflighted JSON and on the upgrade, no `Origin` with `Sec-Fetch-Site: cross-site`, and a foreign `Host`, beside the callers that must keep working. Passed by hand 2026-11-08: a foreign page against the desktop app and a local hkp-node, the public playground against a local runtime, the packaged app, a phone on the LAN, and iOS.

**Left.** No per-launch token for the desktop's port (D3): browsers enforce `Origin`, so what remains is other processes and other accounts on the same machine. That an open port can be probed stays as for any local server.

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

### 3. Done 2026-11-08: native page trust was not enforced by navigation policy

The desktop webview allowed every same-window navigation and every permission, and handed any page in it the vault and file access on caller-supplied paths. What the host now allows is in `docs/content/targets.md` ("Only the app's own pages, on the desktop").

**Changed.**

- `meander/backend/pageTrust.h`: `decideNavigation`, `mayGrantPermission` and `FileGrants` (paths compared after `weakly_canonical`).
- `main.cpp`: only the app's own pages load, at any depth; a link the person clicked or a new window opens in their browser, anything else is refused and logged. Permissions are granted for the microphone, the camera and location. `readFile` and `writeFile` reach what a picker returned, and what lies beside or below it. The vault and grants are injected only into the app's own pages.
- `schemeHandler.cpp` names the asking origin in `Access-Control-Allow-Origin` only for an own page; `hkp://local-image/` checks the grants.
- A board's unit references can no longer read any file through `readFile` (from finding 6).

**Tests.** `meander/backend/tests/pageTrust.test.cpp`: origins and lookalikes, every kind of navigation, permissions by origin and type, and file grants beside, below, `..`, a sibling, a symlink out, and writes without a save pick. Passed by hand 2026-11-08 in the packaged app.

**Left.** `saveJSON` writes to its own save pick, as before.

### 4. Done 2026-11-08: hosted boards could reach private networks

On a shared host any board could address loopback services, the host's private network and a cloud provider's metadata endpoint. The rule is in `docs/content/concepts/runtime.md` ("Where a hosted server may connect").

**Changed.**

- With `HKP_EGRESS=public`, a destination a board chose is reached only when every address its name resolves to is public. Checked on the resolved address where the socket opens, so every redirect hop and a name rebinding between lookup and connect are covered; addresses carried inside IPv6 forms are judged by their IPv4 address. `HKP_EGRESS_ALLOW` lists addresses or ranges reached anyway. Unset, nothing changes.
- Exempt: what the operator configured, not a board — the coordinator link and the token issuer's keys.
- hkp-node: `src/egress.ts`, an `undici` dispatcher installed as the process's, so every `fetch` is covered; IMAP and SMTP connect to the checked address.
- hkp-python: `src/hkp/egress.py`, `client_session()` for aiohttp and `urlopen()` for urllib.
- hkp-rt: `lib/include/egress.h` (`egress::resolve`, `egress::asyncResolve`) at each of the eight sites a board can point somewhere; `standalone_config.h` reads the variables.
- Refusals say so ("This server does not reach private addresses (…)") instead of "fetch failed".

**Tests.** `hkp-node/tests/egress.test.ts`, the hosted cases in `imap-email.test.ts` and `smtp-email.test.ts`; `hkp-python/tests/test_egress.py`; `hkp-rt/tests/egress.test.cpp`. Each runtime also has a source scan (`egress-sources.test.ts`, `test_egress_sources.py`, `egress_sources.test.cpp`) that fails on a raw network API used outside the guard, with its exemptions listed. Passed by hand 2026-11-08 on a hosted server.

**Left.** A firewall rule on the hosted process is the backstop on hosts the operator controls; the docs say what it has to leave open.

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

### 6. In progress: the board document as untrusted input

Kept outside this repository until it is done, as `plans/README.md` says of security weaknesses not yet fixed; its write-up comes back here then.

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

### 9. In progress: secret and session exposure at rest

Kept outside this repository until it is done, as `plans/README.md` says of security weaknesses not yet fixed; its write-up comes back here then.

### 10. In progress: facade capabilities and remaining shared-host items

Kept outside this repository until it is done, as `plans/README.md` says of security weaknesses not yet fixed; its write-up comes back here then.

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

First close the local runtimes to foreign origins (finding 1), fix prototype pollution (2), enforce native page trust (3), and decide the hosted network policy (4). Add regressions with each fix. The payload ceiling (5) and the proxy rule (7) are small and can follow; JWT alignment (8) is hardening and need not block v1. In parallel with ordinary implementation work, establish PR E2E execution and the authenticated test harness.

Then add the owner/member/stranger journey, secret-consent journey and one persisted distributed restart journey. Those three tests exercise the most consequential v1 boundaries. Follow with packaged native smoke tests and a smaller Android/mobile facade suite.

Define release acceptance as named journeys actually executed and passing, no unexplained required skips, no cross-tenant disclosure, and recovery without duplicate side effects. Keep optional hardware/provider cases clearly separated.

## Verification performed

- Inspected E2E configs/support/specs, the CI workflow and aggregate test script; reviewed selected runtime/coordinator auth, facade projection, credential redirect handling and desktop bridge/navigation code.
- Playwright test discovery completed: 130 cases across 10 files in the default configuration, including profile instances that are later skipped. Cloud uses a separate configuration.
- Reproduced facade prototype pollution through the actual exported function in an isolated Node process and removed the probe property.
- Second pass, 2026-10-09: re-read the code behind every security finding — facade projection and its callers in the coordinator session, the Node and Python JWT verifiers, origin and auth resolution in hkp-node, the hkp-rt auth middleware and `filesystem` service, and the desktop host's bridge, navigation and frontend server. Ran one further isolated probe through the real `readFacadeAccess`, `projectNotification` and `identityFromClaims`, which showed projection pollution turning into an email on a token without one; the probe removed its properties. Keyword searches, not audits, stand behind the statements that hkp-node has no code-execution primitive, that its outbound services filter no destinations, and that the frontend has one raw-HTML sink.
- Not done in either pass: no request was sent to a running runtime from a hostile origin, no proxied or hosted deployment was exercised, and the PHP and C++ JWT checks were not re-read.
- Did not run the complete browser/native/cloud suites, attack a deployed system, or perform a dependency vulnerability audit. No claim of a green baseline or a complete security assessment is made.
