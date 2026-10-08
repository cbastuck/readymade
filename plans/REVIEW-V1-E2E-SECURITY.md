# Readymade v1: E2E and security review

Reviewed 2026-10-06 against the current working tree, including uncommitted changes. This is a targeted source review of E2E infrastructure, CI, runtime authentication, coordinator facade access, and desktop privilege boundaries. It is not a penetration test or a comprehensive dependency/native-platform audit. No application code was changed.

## Assessment

The project has substantial unit and integration coverage, including tenancy, mount claims, secrets, coordinator restart/reprovision, binary transport, and lifecycle tests. The E2E suite adds valuable checks for real UI behavior, block editing, browser SQL persistence, and coordinator deployment. Stable service UUID locators, touch-driven mobile interactions, failure traces, and expected-failure tracking are good foundations.

The main deficiency is coverage of boundaries: authenticated users across processes, real native bridges, persistence across process restarts, and distributed failure recovery. Adding hundreds of service-panel tests would provide less confidence than a small suite testing these boundaries.

The supplied architecture description says cloud persistence does not exist; the current code and plans include persisted coordinator boards, membership and sharing. Release scope and threat modeling should reflect the implemented system rather than the older description.

## Security findings and investigations

### 1. High priority: confirmed prototype pollution in facade projection

Evidence: `hkp-node/src/coordinator/facadeAccess.ts`, `readPath`, `writePath`, and `pick`. `writePath` traverses ordinary objects without rejecting special path segments or requiring own properties. A path beginning `__proto__` reaches `Object.prototype`.

A local, isolated reproduction called the real exported `projectState` with source path `__proto__.readymadeReviewProbe` and state parsed from JSON containing that property. A fresh object's inherited `readymadeReviewProbe` then equaled the supplied string. The probe cleaned up its property immediately. Output: `{"prototypePolluted":true}`.

Projection is called by coordinator session code when sending member state/configuration/notifications. This confirms the vulnerable primitive; it does not establish unauthenticated reachability, privilege escalation, or remote code execution. A board owner/configuration author controlling facade paths is a relevant actor on a shared coordinator.

Proposal: reject `__proto__`, `constructor`, and `prototype` path segments; traverse own properties only; construct output maps without prototypes. Validate facade paths at ingestion and retain defensive checks at projection. Add regression tests asserting Object.prototype is unchanged, including nested paths, arrays, and inherited state. Assess other path setters and merges using the same rule.

Reference: [OWASP prototype pollution prevention](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html).

### 2. High priority: native page trust is not enforced by navigation policy

Evidence: `meander/backend/main.cpp` accepts every permission request, allows every same-window navigation, injects the complete vault as `window.__HKP_VAULT__` at document creation, and exposes `readFile`, `writeFile`, secret modification and grant modification methods. Only new-window navigation is diverted to the system browser. `schemeHandler.cpp` also uses broad CORS headers.

The permission-handler comment assumes only trusted local pages load, but the navigation handler does not enforce that assumption. External navigation could place an untrusted document inside a privileged webview. Actual exposure of each bridge function and injection on each native engine still needs a real-host exploit test.

Proposal: allowlist exact app origins and routes; open external URLs in the system browser; enforce bridge caller/frame origin; deny privileges in remote documents and frames. Replace blanket permissions with origin- and capability-specific decisions. Gate file access through approved file handles/paths rather than unrestricted caller-supplied paths. Keep secrets behind native operations where practical, instead of injecting the entire vault.

Required tests: external same-window links, redirects, iframes, custom schemes and deep links cannot read vault data, call file operations, change grants, or acquire camera/microphone permission. Run these on actual native hosts.

### 3. High priority: JWT checks differ across runtimes

Evidence: Node's `createJwtVerifier` passes `audience` to `jwt.verify`, but no expected `issuer` or explicit algorithm list. Python's `_verify_jwt` restricts RS256 and audience, but passes no issuer and requires no expiry claim. Node also does not explicitly require expiry. The Python signed-token tests intentionally accept tokens without `iss` or `exp`. PHP checks issuer/RS256/expiry; C++ explicitly checks issuer and RS256.

Trusted JWKS keys still constrain signatures: this is not evidence that arbitrary unsigned or attacker-signed tokens work. Nevertheless, fetching keys from a configured issuer does not validate the token's issuer claim, and an optional expiry check does not reject missing expiry.

Proposal: align issuer, audience, accepted algorithms, mandatory claims and token type across runtimes. Require nonempty subject and expiry; define clock skew and acceptance of multiple client audiences. Document the deliberate use of ID tokens as API credentials, or adopt API access tokens with explicit scopes.

Required tests: locally signed tokens against a controlled JWKS endpoint, covering valid tokens, wrong/missing issuer, wrong audience, absent/expired expiry, future not-before, invalid signatures, disallowed algorithms, key rotation and unverified email. Exercise real HTTP and WS entry points rather than replacing authentication with a principal resolver.

Reference: [JWT best current practices, RFC 8725](https://www.rfc-editor.org/info/rfc8725/).

### 4. High priority investigation: no-auth localhost plus permissive browser origins

Evidence: Node permits no-auth on loopback; `parseAllowedOrigins` defaults to `*`, HTTP CORS reflects arbitrary origins, and the WS origin check allows any origin with that default. The desktop runtime also supplies `*` as allowed origins.

Loopback prevents remote network connections, but a webpage in a user's browser can attempt to reach local services. Browser local-network restrictions vary and should not be the sole application defense. Current tests prove rejection when an explicit allowlist is supplied, not safe default behavior.

Proposal: require explicit trusted browser origins for local HTTP/WS control, validate Host to address DNS rebinding, and consider a local capability token for native control. Test a hostile browser origin against actual loopback servers, including WS and simple requests. Origin checks should protect control routes without accidentally breaking intentional public board mounts or machine clients.

### 5. High priority: unbounded coordinator WebSocket payloads

Evidence: `maxPayload: 0` in `hkp-node/src/server.ts` (bridge), `coordinator/join.ts`, and `coordinatorLinks.ts` disables the ws payload limit. Node runtime/service/timer quotas default to unlimited or unrestricted in `index.ts`.

Proposal: establish finite hosted defaults for frame size, in-flight requests, buffered outbound bytes, execution concurrency, connections, timers, storage and logs. Bound nested services too. Large binary/audio data should have a defined chunking/streaming contract. Bound parsing and reject malformed YAS/bridge frames before expensive allocation. An authenticated tenant is still capable of exhausting a shared process.

Required tests: oversize/truncated frames, notification floods, slow readers, disconnect during transfer, low quota enforcement, and another tenant remaining responsive. Run destructive load tests only in isolated disposable environments.

### 6. Before v1: secret and session exposure

Evidence: `meander/frontend/src/auth/session.ts` persists refresh and ID tokens in localStorage; desktop injects the whole vault; `plans/TODO-SECRETS.md` records plaintext vault persistence with restrictive file permissions. Audience-aware redirect handling in Node's `credentialedFetch.ts` is a positive existing control.

Proposal: move native refresh tokens and vault values into platform secure stores, minimize JS access, and define revocation/rotation for long-lived machine credentials. Add canary-secret assertions covering export, saved boards, member snapshots, logs, errors, notifications and Playwright artifacts. Test credential audience behavior across HTTPS downgrade, redirect chains, custom headers and body payloads; header protection alone is not a complete egress policy.

Reference: [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

### 7. Investigate shared-host isolation and facade capabilities

HTTP clients and asset downloads intentionally access user-selected URLs. Decide explicitly whether hosted boards may access private networks, loopback and cloud metadata. If not, enforce policy at every redirect and resolved destination and preferably at the network layer. Local boards may legitimately need LAN access, so apply deployment-specific policy.

`coordinator/facadeAccess.ts` explicitly grants any payload to a facade-exposed process target. Hiding fields in the UI cannot enforce business rules. Test forged caller identity, arbitrary actions, nested addresses, unauthorized configuration, duplicate/replayed submissions, and projection of whole notifications. Member removal must invalidate existing sockets as well as new connections. Include public mount URLs and asset URLs in the capability/revocation inventory.

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

1. **Make E2E a release gate.** No supplied GitHub workflow references Playwright/E2E. `run-all-tests.sh` also omits it. The selected CI workflow only runs C++ and frontend tests and triggers on main pushes/manual dispatch, not pull requests. Add PR jobs for fast browser tests and runtime integration, a scheduled native/cross-runtime suite, and a mandatory release suite. Check out submodules and their pinned commits correctly. Use lockfile installs and upload failure reports/traces with controlled access and retention.
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

First fix prototype pollution, enforce native page trust, align JWT validation, and decide local-origin/hosted resource policies. Add regressions with each fix. In parallel with ordinary implementation work, establish PR E2E execution and the authenticated test harness.

Then add the owner/member/stranger journey, secret-consent journey and one persisted distributed restart journey. Those three tests exercise the most consequential v1 boundaries. Follow with packaged native smoke tests and a smaller Android/mobile facade suite.

Define release acceptance as named journeys actually executed and passing, no unexplained required skips, no cross-tenant disclosure, and recovery without duplicate side effects. Keep optional hardware/provider cases clearly separated.

## Verification performed

- Inspected E2E configs/support/specs, the CI workflow and aggregate test script; reviewed selected runtime/coordinator auth, facade projection, credential redirect handling and desktop bridge/navigation code.
- Playwright test discovery completed: 130 cases across 10 files in the default configuration, including profile instances that are later skipped. Cloud uses a separate configuration.
- Reproduced facade prototype pollution through the actual exported function in an isolated Node process and removed the probe property.
- Did not run the complete browser/native/cloud suites, attack a deployed system, or perform a dependency vulnerability audit. No claim of a green baseline or a complete security assessment is made.
