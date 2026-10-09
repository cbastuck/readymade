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
- Initialization scripts reseed boards and recreate fake native storage on navigation. Several specs use fixed sleeps. Both need addressing before adding persistence journeys.
- Existing SQL tests replace caller fields with a fixed identity: useful for persistence, but not a test of authenticated callers.
- Local-runtime origin protections are currently being implemented separately. Test configurations must use explicit trusted origins and verify legitimate clients still connect; do not restore wildcard access to make tests pass.

The initial baseline was checked from source. Execution evidence from milestone 1 is recorded below.

## Progress

Update this table in place. Mark a milestone done only after its checks pass in the intended environment. Record failures, required skips and outstanding dependencies under that milestone.

| Milestone | State | Depends on | Completion evidence |
| --- | --- | --- | --- |
| 1. Reliable fixtures and baseline | in progress | — | Reload-safe fixtures and regressions implemented; full default suite passing; diagnostics/cleanup work remains |
| 2. PR and cloud CI | open | 1 | Required PR jobs and failure artifacts demonstrated |
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
- [ ] Centralize page-error collection, relevant console/network failures and attachments. Review expected failures individually; avoid a blanket ignore for network errors.
- [ ] Provide unique names, cleanup in failure-safe fixtures and disposable directories for servers. Cleanup must not conceal the original failure; attach cleanup failures separately.
- [ ] Prevent external side effects: route fixture APIs to controlled responses and use synthetic credentials. Make any external model/media dependency explicit.

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

Remaining in this milestone: centralize diagnostics and reviewed expected failures, failure-safe server cleanup, explicit external-dependency handling, and the full-default three-run check. Do not mark the milestone done after only the fixture slice.

## 2. PR and cloud CI

Extend the existing workflow rather than duplicating its default E2E job.

- [ ] Enable PR execution with appropriate permissions, cancellation of obsolete runs and required check names documented for repository settings.
- [ ] Keep a fast default-suite job and add a separate Node cloud job. Check out the required submodules at pinned revisions and install required application dependencies from lockfiles.
- [ ] Add an explicit trusted-origin configuration matching the test servers, compatible with the local security changes.
- [ ] Include E2E in the documented aggregate test entry point, or provide an explicit aggregate option if running browsers by default is too costly. Document that distinction.
- [ ] Publish executed/skipped/retried counts and upload traces, screenshots, browser errors and server logs on failure, with bounded retention. Use synthetic data; prevent credential disclosure in artifacts.
- [ ] Make required runtime/media fixtures fail configuration checks when missing; keep genuinely optional capability lanes explicitly optional.

Done when a PR runs both jobs, a deliberately failing test produces useful artifacts, and required missing dependencies cannot silently turn a job green. Record actual runtimes before deciding budgets or sharding.

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
