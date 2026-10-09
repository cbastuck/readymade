# End-to-end test implementation plan

Created 2026-10-09. Companion to [the v1 review](REVIEW-V1-E2E-SECURITY.md). This document tracks E2E work; security implementation decisions and their progress remain in that review.

## Objective

Make a small, reliable set of real user journeys a release gate for Readymade: boards can be built and saved, deployed across runtimes, shared safely, and recovered after failures on supported hosts.

Prioritize boundaries between components. Keep detailed service semantics, parser edge cases and exhaustive permission matrices in unit/API integration tests; use E2E to show those components work together through the shipped interface.

## Current baseline

- `e2e/playwright.config.ts` drives web Chromium, simulated desktop Chromium and simulated iOS WebKit against development servers.
- Main-branch/manual CI now runs the default E2E configuration, installs from lockfiles and uploads failure artifacts. PR execution and cloud execution still need adding.
- `playwright.cloud.config.ts` runs real Node/coordinator deployment tests with authentication disabled; C++ coverage depends on a locally available binary. Python is not included in this configuration.
- Native behavior comes from `support/fakeNativeHost.ts`, not the actual packaged apps.
- Milestone 1 now keeps seeds/native storage across reloads and polls positive persistence conditions. Bounded negative observation windows remain intentional.
- Existing SQL tests replace caller fields with a fixed identity: useful for persistence, but not a test of authenticated callers.
- Local-runtime origin protections are currently being implemented separately. Test configurations must use explicit trusted origins and verify legitimate clients still connect; do not restore wildcard access to make tests pass.

The initial baseline was checked from source. Execution evidence from milestone 1 is recorded below.

## Progress

Update this table in place. Mark a milestone done only after its checks pass in the intended environment. Record failures, required skips and outstanding dependencies under that milestone.

| Milestone | State | Depends on | Completion evidence |
| --- | --- | --- | --- |
| 1. Reliable fixtures and baseline | done | — | Three complete default runs without retries: 124 passed / 36 documented skips each; cloud 7 passed including C++; diagnostics and failure-safe cleanup verified |
| 2. PR and cloud CI | in progress | 1 | PR #41: browser 124 passed / 36 documented skips, Node cloud 6 passed; hosted failure-artifact upload and seven-day retention verified |
| 3. Core board journeys | open | 1 | UI lifecycle/composition/mobile journeys passing |
| 4. Authenticated sharing and secrets | open | 1, 2; relevant security fixes | Real verifier and multi-context journeys passing |
| 5. Distributed persistence and recovery | open | 2, 4 | Restart/failure journeys against Node, Python and C++ |
| 6. Production and native release checks | open | 3–5 | Built-bundle lane and per-host release evidence |

## 1. Reliable fixtures and baseline

Work primarily in `e2e/support/test.ts`, `fakeNativeHost.ts`, existing draft/rename specs and the E2E README.

- [x] Run default and cloud suites, recording duration, executed/skipped/expected-failure counts and reasons. Separate failures introduced by in-progress application work from test defects.
- [x] Seed browser storage once, without overwriting state on reload. Keep host detection/bridge initialization before application module evaluation.
- [x] Give the fake host persistent, test-owned storage across document reloads. Choose a fixture storage adapter consistent with the real host contract; test the adapter explicitly. Keep state isolated between tests.
- [x] Add a regression that changes a seeded value, saves, reloads and sees the changed value, then reopens from the library. Ensure it fails if initialization restores the original fixture.
- [x] Replace draft/rename sleeps with polling of persisted state or a visible saved condition. Retain bounded observation windows where the requirement is that an event does not repeat.
- [x] Centralize page-error collection, relevant console/network failures and attachments. Review expected failures individually; avoid a blanket ignore for network errors.
- [x] Provide unique names, cleanup in failure-safe fixtures and disposable directories for servers. Cleanup must not conceal the original failure; attach cleanup failures separately.
- [x] Prevent external side effects: route fixture APIs to controlled responses and use synthetic credentials. Make any external model/media dependency explicit.

Done when existing enabled journeys pass in three consecutive clean runs without retries, the reload regression passes on applicable profiles, and remaining skips have documented owners/reasons. This establishes a local baseline, not a claim that flakes are eliminated.

### First implementation slice

- `seedBoard` now uses a per-origin marker independent of the saved board: edits are not overwritten and deleted boards are not recreated. Native seed delivery handles either initialization-script order.
- The fake native store persists all nested writes in context-owned localStorage. This tests the host contract across document replacement, not real disk/keychain storage or live multi-document synchronization.
- `board-persistence.spec.ts` changes a timer unit through its UI, saves, reloads and reopens on web/desktop/mobile; checks native files/secrets/audiences/grants/settings across reload; and proves deleted seeds stay deleted. Independent tests using the same seed name also exercise fresh-context isolation.
- Positive draft/rename waits now poll IndexedDB for the expected draft. Existing bounded negative observation windows remain because they test that untouched boards do not produce a draft.
- Full default suite: **108 passed, 31 skipped, 2.6 minutes**, without retries. The passed count includes the existing expected failure for `reduce-demo-board`. Thirty skips are profile exclusions (including the native-only adapter check on web); one is the missing optional face-video fixture on web. Full-default three-run verification remains outstanding.
- Against an isolated copy of the original fixtures, all five applicable new web/desktop checks failed as expected; the native-only check on web skipped. Current fixtures were not replaced for this check.
- Persistence/draft/nested-rename tests repeated three times without retries: **30 passed, 15 profile skips, 1.5 minutes**. These are repeated affected journeys, not three full-default runs.
- Cloud baseline: **7 passed, no skips, 17.6 seconds**, including C++ deployment. Authentication remains disabled in this existing lane; Python is not covered.
- TypeScript verification passes. Existing fake-host preset-library 404/fallback console errors still need an explicit solution during diagnostics work. Mobile rename-display and expanded-view control overlap observed while designing the regression need separate investigation; the final persistence journey uses the normal card-view save flow.

### Diagnostics and cleanup slice

- Automatic context-wide diagnostics collect page exceptions, application console errors, failed requests and HTTP errors. Uncaught exceptions/unreviewed application console errors fail successful journeys; original failures survive teardown. Browser diagnostics and failing-cloud runtime logs are attached with basic token redaction.
- Browser HTTP/WS traffic is limited to application/server origins, service workers are blocked, and explicit page mocks take precedence. Cloud credentials are synthetic. This does not sandbox runtime-server outbound traffic; current cloud boards use local services only.
- The native preset adapter now persists source text through list/save/delete and reload. Initialization ignores blank/subframe documents, fixing previously hidden localStorage SecurityErrors.
- Cloud cleanup attempts every deletion, verifies empty board/runtime lists and attaches errors separately. Runtime wrappers allocate fresh data directories, retain logs and remove data on startup failure or graceful termination. The independent WebRTC probe closes its owned browser in a finally block.
- Fixture contract checks exercise diagnostics with intentional browser failures, redaction/mock precedence/native presets, and cleanup after partial failure. Process checks verify startup exit code/logs and graceful data removal.
- **Application defects resolved before milestone 2:** Fetcher keeps URL/body/body-expression UI values as empty strings when service state is null, avoiding uncontrolled inputs and allowing a previously configured URL to clear. Its panel regression rejects the original implementation and passes with the fix. The vendored Crow WebSocket close path now replies to a close without status using an empty frame, preserving 1005 only as local callback metadata. It previously transmitted that reserved code, causing the C++ handover browser error. Wire-level server tests cover both empty close and normal 1000 close. Both per-spec console exceptions are removed.
- The reduce demo's existing expected failure remains owned by the shipped-board/service registry work in milestone 3. Optional face media is owned by the capability-fixture work: absence skips, an explicitly supplied invalid file fails configuration. Other skips are declared host/profile exclusions, not missing product coverage disguised as passing tests.
- Three consecutive complete default runs with the finished fixtures: **124 passed / 36 skipped each**, **5.0, 5.1 and 3.6 minutes**, two workers, no retries. The passed count includes four expected failures: the three injected diagnostic probes and the existing reduce demo. Thirty-five skips are explicit host/profile exclusions; one is the absent optional web face-video fixture. Reload/save/reopen passed on all three profiles in every run.
- Final cloud run: **7 passed, no skips, 21.0 seconds**, no retries, including C++ deployment/output. Both runtime logs recorded disposable-data removal, and both temporary directories were verified absent after shutdown. This remains the existing no-auth Node/C++ lane; authenticated deployment and Python belong to later milestones.
- TypeScript validation and staged/unstaged whitespace checks pass. Diagnostics, mock precedence, cleanup after partial failure, process startup failure and normal shutdown are covered by executable fixture contract checks.
- A four-worker trial hit the 30-second overall budget in desktop/mobile persistence journeys; it is not counted as clean evidence. The milestone baseline uses the existing two-worker CI concurrency. Explicitly naming a missing face-video fixture was separately verified to fail discovery.

### Application defect verification

- send-ntfy smoke: **1 passed, 5.6 seconds**, no retries and no console exception.
- Full Node/C++ cloud suite against the rebuilt runtime: **7 passed, 22.2 seconds**, no retries and no handover console exception.
- Fetcher panel regression: **1 passed**; a temporary restoration of the original setters made this same test fail, after which the fix was restored and verified again. Frontend TypeScript validation passes.
- C++ close regressions: **2 passed, 10 assertions**. Broader C++ server/auth validation passed **58 cases, 245 assertions** on its second execution.
- **Separate reliability observation:** the first broader C++ execution crashed with SIGSEGV in the existing `a request handed over in-process is served, and names nobody` case (55 preceding cases passed). That case then passed in isolation and the full suite passed on rerun. Its cause is not established; it is not counted as an unconditionally clean first run and remains a runtime/test-lifecycle follow-up before v1. The two repaired product journeys passed without retries.

## 2. PR and cloud CI

Extend the existing workflow rather than duplicating its default E2E job.

- [x] Enable PR execution with appropriate permissions, cancellation of obsolete runs and required check names documented for repository settings.
- [x] Keep a fast default-suite job and add a separate Node cloud job. Check out the required submodules at pinned revisions and install required application dependencies from lockfiles.
- [x] Add an explicit trusted-origin configuration matching the test servers, compatible with the local security changes.
- [x] Include E2E in the documented aggregate test entry point, or provide an explicit aggregate option if running browsers by default is too costly. Document that distinction.
- [x] Publish executed/skipped/retried counts and upload traces, screenshots, browser errors and server logs on failure, with bounded retention. Use synthetic data; prevent credential disclosure in artifacts.
- [x] Make required runtime/media fixtures fail configuration checks when missing; keep genuinely optional capability lanes explicitly optional.

Done when a PR runs both jobs, a deliberately failing test produces useful artifacts, and required missing dependencies cannot silently turn a job green. Record actual runtimes before deciding budgets or sharding.

### Implementation evidence

- Extended the existing workflow with PR events, read-only permissions, non-persisted checkout credentials and obsolete-run cancellation. Stable job names: `E2E browser`, `E2E Node cloud`; repository protection selection is documented rather than changed.
- Node cloud CI checks out only the public Node submodule at its gitlink revision, uses lockfile installs and explicitly selects the Node lane. C++/Python are outside this required check; the local all-runtime lane preserves optional C++ discovery and adds a required-binary switch.
- After clean `npm ci` installs in all four application/test folders, the CI-style browser run passed **124 tests (120 normal + 4 expected failures), 36 profile/media skips, 3.4 minutes**, with no retries or flakes. Node-only cloud passed **6 tests, no skips/retries, 17.4 seconds** against pinned `c911bd08`.
- Local intentional failure verified the HTML report's embedded Node log/browser error plus trace, screenshot, video, browser JSON and server log files. The flaky probe failed once, passed its retry and still returned failure with one flaky/one retried test in the summary. It is excluded from ordinary discovery.
- Missing Node dependencies, mandatory C++ binary and mandatory face media, plus an explicitly invalid C++ binary path, all rejected configuration. Reporter count-contract tests, TypeScript, workflow lint and aggregate shell syntax checks pass.
- Hosted PR [#41](https://github.com/cbastuck/readymade/pull/41): Node cloud passed. The first browser run completed 123 passing outcomes and 36 skips in 9.5 minutes, but mobile persistence exceeded its 30s total budget on both attempts. Traces showed successful 6–12s document loads; that multi-navigation journey now has a bounded 60s budget. The adjusted journey passed in the subsequent hosted run.
- Hosted [passing PR run](https://github.com/cbastuck/readymade/actions/runs/37954358315): **browser 124 passed / 36 documented skips in 3.2 minutes**, **Node cloud 6 passed / no skips in 37.2 seconds**. Both named checks are green under the policy that rejects flakes. The Node job log confirms checkout of pinned `c911bd08`.
- Hosted [intentional failure probe](https://github.com/cbastuck/readymade/actions/runs/37952298004) successfully uploaded `e2e-node-cloud-failure-report`. The downloaded artifact contains its HTML report/embedded runtime log, trace, screenshot, video, browser diagnostics and failed/retried counts. GitHub confirms expiry on 2026-10-16 (seven-day retention).

## 3. Core board journeys

Use small deterministic boards. Keep shared host interactions in fixtures; assert both visible behavior and saved descriptors where appropriate.

- [ ] Create through the UI; add/configure/reorder services; run known data; save, close and reopen; rename and delete. Cover cancelling a destructive action.
- [ ] Export and import a board and verify equivalent behavior and state. Test invalid input with a useful error and no partial replacement of the existing board.
- [ ] Exercise SubService/Switch/block composition through configure → run → save → reopen, including one wrap/detach journey. Assert output, not only that panels render.
- [ ] Close/replace a running board and prove autonomous outputs stop. Keep detailed timer/socket/media leak assertions in lower-level lifecycle tests.
- [ ] Exercise a representative mobile facade, service editing and return navigation using touch. Add an Android Chromium/touch profile with the existing fake Android host; describe it as shell coverage, not a real Android app test.
- [ ] Add static validation of all shipped board registries, nested services, blocks and facade references. Use existing regression infrastructure where possible. Fix or retire known broken shipped examples; run meaningful output checks for a representative subset.

Done when the named journeys pass on their declared profiles. Avoid multiplying identical semantics across every host; repeat host-dependent interactions and retain a basic run/save check on each host.

## 4. Authenticated sharing and secrets

Add an authenticated configuration/harness alongside the fast no-auth cloud suite.

- [ ] Generate test signing keys and serve controlled JWKS; configure real runtime verifiers. Keep provider-specific setup injectable only through explicit test configuration. Do not replace production authentication with a principal stub.
- [ ] Create independent owner/member/stranger browser contexts with distinct signed identities. Seed sessions for product journeys; separately test actual login/PKCE configuration in a small isolated staging smoke check.
- [ ] Owner deploys/shares; member opens and uses the facade; stranger cannot attach/read/process. Include direct API/WS attempts to prove hidden controls are not the authorization boundary.
- [ ] Remove a connected member and verify subsequent requests/notifications are denied. Check fresh connections too. Follow the intended revocation contract in the membership plan.
- [ ] Verify server-authenticated caller identity reaches a stateful action. Test two users competing for the same booking: exactly one succeeds, both see consistent state.
- [ ] Exercise token expiry and failed renewal, with an understandable UI recovery path. Keep the full invalid-token claim matrix in verifier/API tests.
- [ ] Secret consent: deny, approve only selected aliases, change destination and revoke consent. Capture requests and assert what was actually transmitted.
- [ ] Place canary secret values in the test vault and assert absence from exported/saved board descriptors, member snapshots, logs and error payloads. Verify audience rejection and one controlled redirect journey.
- [ ] Add hostile-origin HTTP/WS browser checks against local servers, alongside positive trusted-origin and intentional-public-mount cases. Keep forged Host and parser edge cases in API integration tests.

Relevant known security defects should get regressions with their fixes. Do not turn release-blocking failures into permanent expected failures merely to land the suite. Record blocked journeys with their concrete dependency.

Done when access and revocation checks pass through real verifiers, the concurrency result is unambiguous, and canary secrets reach only intended destinations. No production accounts or secrets are needed for PR jobs.

## 5. Distributed persistence and recovery

Extend server fixtures to start, stop and restart child processes explicitly. Point stores at per-test temporary directories retained across intentional restarts, then remove them during cleanup.

- [ ] Build small mixed-runtime boards using deterministic services and compare final output for JSON/text and binary/MixedData. Cover null stopping propagation and early return with observable downstream effects.
- [ ] Add required Python and C++ runtime lanes. Explicitly provision their dependencies/binaries instead of relying on a developer's build directory.
- [ ] Deploy, write records, restart the coordinator and reopen from a fresh browser context; records and board configuration survive.
- [ ] Restart a participant and verify reconnect/reprovision without duplicate services, timers, mounts or effects. Use finite, identifiable inputs rather than timing alone.
- [ ] Interrupt deployment and retry; ensure recovery leaves no orphan participants or duplicate boards.
- [ ] Drop a connection during processing/configure, restore it and verify the documented outcome. Determine retry/idempotency semantics from the implementation before asserting automatic retries for side-effecting actions.
- [ ] Assert another tenant remains isolated during recovery. Keep destructive resource-exhaustion tests in a disposable load/API lane, not routine UI runs.

Done when persisted recovery passes with actual process restarts and all required runtimes execute in CI. A simulated error response alone does not satisfy a restart test.

## 6. Production and native release checks

- [ ] Run selected critical journeys against built frontend assets and packaged runtime artifacts. Preserve the development-server configuration for local iteration.
- [ ] Run real-host bridge conformance checks for scheme routes, exposed methods and returned shapes, so fake-host drift fails visibly.
- [ ] Establish one packaged-app smoke journey per supported OS: launch, open/run/save/reopen, file dialog cancel/save/open and session restore. Determine feasible automation per native engine before selecting tooling; Playwright browser emulation is not sufficient evidence.
- [ ] On real hosts, verify external navigation/frame/deep-link handling cannot access vault/file/grant operations or gain media permissions. Include positive trusted-app cases.
- [ ] Add actual iOS/Android device or simulator checks for touch, keyboard, background/resume and denied media permission. Use documented manual checks temporarily where automation is unavailable; retain release evidence and an owner.
- [ ] Keep camera/audio/peer board checks in explicit deterministic capability lanes. Required release fixtures must exist; distinguish transport probes from actual product journeys.

Done when each advertised host has recorded release evidence, the production-bundle journeys pass, and any manual checks are explicit rather than disguised as automated coverage.

## Execution and release rules

Implement milestones as small reviewable changes: fixture persistence; error/cleanup handling; PR job; cloud job; lifecycle journeys; auth harness; membership; secrets; restart harness; recovery; native checks. Each change includes the relevant documentation and a meaningful regression/check.

After each change, run the affected journey/profile first, then the suite whose fixtures/configuration changed. Re-run broader suites only when changes affect them or evidence justifies it. Track retry-only successes as flake work rather than ordinary passes.

For v1 require core lifecycle, authenticated access/revocation, secret boundaries, persisted distributed recovery, and supported-host smoke evidence. Required cases cannot be skipped. Record optional hardware/provider coverage separately. CI workflow execution alone does not establish branch protection; configure required checks in repository settings when job names are stable.

First implementation slice: milestone 1's reload-safe fixtures and persistence regression, followed by PR/default and Node-cloud CI. This makes later tests trustworthy and gives every subsequent change feedback.

Follow-up verification: the final documentation run exposed the exact informational MediaPipe CPU startup line and SQL writes that had not finished before downstream UI completion/navigation. The face smoke expectation is scoped to that exact line; SQL processing now awaits persistence before returning downstream. SQL unit regressions: 29 passed. Affected browser journeys repeated three times without retries: 6 passed / 6 profile exclusions, 23 seconds. Hosted follow-up fixed both failures but exposed a draft-journey timeout that passed its retry (CI correctly stayed red). Its three document loads took 5.0s, 4.8s and 9.9s, plus autosave checks; it now has the same bounded 60s multi-navigation budget. Full local suite after the SQL fix: 124 passed / 36 skips, 3.2 minutes, no retries. The next hosted run passed the draft journey but detected the same MediaPipe INFO line in detect-demo-board; both shipped detector boards now share the exact reviewed expectation. Final hosted follow-up pending.
