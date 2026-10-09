# End-to-end tests

One suite, driving the same webapp as each of the hosts it ships inside.

```
npm ci
npx playwright install chromium webkit
npm test                 # all three profiles
npm run test:desktop     # one of them
npm run report           # last run's HTML report
```

The dev servers start automatically (`webServer` in the config) and an already
running one is reused, so `vite` in either app is picked up rather than fought
over.

## Watching a test run

```
npm run test:ui                        # UI mode — pick tests, watch, time-travel
npm run test:headed -- --project=web   # a real browser window, full speed
npm run test:debug                     # step through with the Inspector
npm run report                         # the last run, after the fact
```

**UI mode** is the one to reach for. It opens a window listing every test, runs
what you pick, and shows the run as a timeline of steps: click a step and it
shows the DOM as it was at that moment, before and after, with the locator
highlighted. It watches files and re-runs on save, and has a pick-locator tool
that hands you a selector for anything you click. It is the closest thing here
to the Cypress runner.

**Headed** is plainer: a real browser window at full speed, which is fast enough
to be a blur. To actually watch the interactions, slow them down:

```
npm run test:headed -- --project=mobile --grep "a board runs"
```

and add `launchOptions: { slowMo: 400 }` to that project's `use` block while you
watch. The mobile project opens a real WebKit window at iPhone size, so the
touch journey is visible as it happens.

**After a failure** there is no need to re-run anything: `trace: retain-on-failure`
means the failing run was recorded. `npx playwright show-trace <path>` — the path
is in the failure output — replays it step by step with the same DOM snapshots
UI mode gives, including for a failure that happened in CI.

There is also an official **VS Code extension** (`ms-playwright.playwright`): it
puts a run button beside each test, can open the browser as it runs, and lets
you set breakpoints in a spec and step through with the browser paused alongside.

## Profiles

A profile is a host: the same bundle, told a different story about what it is
running inside. Each is a Playwright project, so a spec is written once and
told which host it is on.

| Project   | App               | Engine   | Platform host                    |
| --------- | ----------------- | -------- | -------------------------------- |
| `web`     | `hkp-frontend`    | Chromium | none — signed out, no capabilities |
| `desktop` | `meander/frontend`| Chromium | fake saucer + `hkp://` scheme    |
| `mobile`  | `meander/frontend`| WebKit   | the same fake, mounting `MobileApp` |

`mobile` runs WebKit on an iPhone device descriptor because that is what the
iOS app is: a WKWebView with real touch. The shell has its own gesture code, so
the specs tap rather than click there — a synthetic click would skip the
handlers it actually listens on. Android is the same shell on Chromium; it
shares these specs and is not yet a separate project.

## What stands in for the native side

`support/fakeNativeHost.ts` implements both surfaces the Readymade shells reach
the platform through:

- `window.saucer.exposed.*` — file dialogs and the secret store
- `fetch("hkp://…")` — boards, remotes, settings, history, the start-page tree

Both are installed as a **page init script**, and that is not a stylistic
choice. The app decides what host it is on while its modules evaluate:
`isMeanderApp()` memoises a single `hkp://boards/` probe, and
`MeanderPlatformProvider` reads `saucer.exposed` at module scope. Anything
installed after the first navigation is too late, and what you get is a
confusing half-native app rather than a clean failure.

`page.route` cannot serve any of this — `hkp://` is not http, so it never
reaches Playwright's proxy. Wrapping `window.fetch` is the only way in.

Everything the host is asked to store is mirrored on `window.__HKP_FAKE_HOST__`
and reachable through the `hostState()` fixture, so a spec can assert on what
the app actually handed the platform, not only on what the UI shows.

The fake's backing store lives in origin-local browser storage inside each
test's fresh Playwright context. Writes to boards, files, settings, secrets,
audiences and grants survive document reloads; another test starts clean.
This is a test adapter, not native disk/keychain coverage. It does not provide
live synchronization between simultaneously open documents; concurrent native
library tests will need a shared host adapter.

`seedBoard` seeds each name once per origin. Its marker survives a board's
deletion, so reloads neither overwrite saved edits nor recreate deleted boards.
Native seeds are queued when the fake has not booted yet; correctness does not
depend on the order Playwright runs initialization scripts. Set up seeds before
the first navigation. Reopening should use the same fixture/context without
calling a fresh seed helper.

`tests/board-persistence.spec.ts` edits a timer through its panel, saves through
each shell, reloads and reopens, and checks both the saved setting and the UI.
It also checks deletion and native host writes across document replacement.

### What this does and does not cover

It covers everything above the platform boundary, given a conforming host. It
does not cover the boundary itself: rename a `saucer.exposed` function or
change an `hkp://` route and this suite stays green while the shipped app
breaks. The fake is written against `BackendAdapter`, so TypeScript catches a
changed shape — but a changed *route* needs a per-host smoke check by hand.

The fake is also useful outside the tests: it runs the desktop UI in a plain
browser with a working board library, no saucer build needed.

## The shipped-board sweep

`tests/smoke/shipped-boards.spec.ts` opens every browser-only board in
`boards/` and asserts that each service it declares renders a
frame. Around a minute for 63 boards, `web` profile only — it asks about board
JSON, not about a host, so one profile answers it.

The bug it exists for is drift. When a board names a `serviceId` the registry no
longer has, `createService` logs a `console.error` and returns null: the board
still opens, looking fine, minus a piece. Nothing else notices, including a
person opening the board casually. So the assertion is per declared uuid rather
than "the page rendered".

It is deliberately narrow. It does not claim these boards *work* — many want a
camera, an API key or a network — only that every part they are made of still
exists. Boards with a `rest` runtime are excluded: they reach for an hkp-node or
hkp-python that a sweep has no business starting.

Broken boards are recorded in `KNOWN_BROKEN` with the reason, and marked
`test.fail()` rather than skipped. A listed board is *expected* to fail, so the
suite stays green and honest — and when someone fixes one it passes
unexpectedly, the run goes red, and the entry has to be removed. That is the
only reliable way a known failure ever gets cleaned up.

## The cloud specs

`tests/cloud/` deploys boards to a real coordinator, so it needs a runtime
server — and has its own config, so the suite above stays fast:

```
npm run test:cloud       # playwright.cloud.config.ts
```

It starts one hkp-node on loopback (port 18080) as both runtime server and
coordinator, using a disposable data directory, and drives the desktop shell against it.
Where hkp-rt has been built (`hkp-rt/run-tests.sh` builds it; `HKP_RT_BIN`
names a binary built elsewhere) it is started too, on port 18087, as a second
runtime server, and `deploy-rt.spec.ts` deploys a board onto it. Without the
binary that spec is skipped.
Two things a spec supplies that the shell would otherwise get from a person:

- **a session** — `readymade-id-token` in localStorage, an unsigned token the
  app only reads the subject and expiry of. hkp-node on loopback runs without
  authentication, so nothing verifies it;
- **a remote** — `test.use({ hostConfig: { remotes: [...] } })`, which the fake
  native host reports as the runtime servers this host knows by name.

The server is shared by every spec and has one tenant, so specs use their own
runtime ids and board names. `afterEach` attempts every board/runtime deletion,
verifies both lists are empty, and attaches cleanup failures without replacing
an earlier test failure. A cleanup failure fails an otherwise passing test.
`support/runtime-server.mjs` captures Node/C++ logs under
`test-results/servers/` and removes its own temporary data on startup failure
or normal SIGTERM shutdown. Forced termination (SIGKILL) cannot run cleanup.

## Capability checks

`tests/capabilities/` holds environment probes rather than product tests —
things the real suite stands on, worth failing in isolation instead of inside a
board. `webrtc.spec.ts` establishes a data channel between two browser contexts
with plain WebRTC and no signalling server; it is what the peer/multi-user
specs depend on. It also documents why `CHROMIUM_ARGS` exists: without
`--disable-features=WebRtcHideLocalIpsWithMdns`, Chrome hands out `.local` mDNS
candidates that two isolated contexts cannot resolve for each other, and
pairing never completes — silently. With the flag, and with no STUN at all,
pairing takes under a second.

## Adding a spec

Boards live in `fixtures/boards/`. Seed one and open it:

```ts
test.beforeEach(async ({ seedBoard }) => {
  await seedBoard(board.boardName, board);
});

test("…", async ({ page, openBoard }) => {
  await openBoard(board.boardName);
  await expect(service(page, "my-service-uuid")).toBeVisible();
});
```

`seedBoard` puts the board everywhere a shell might look for it — localStorage
and the fake host's library — so specs stay free of that distinction.
`openBoard` then takes each shell's own route in: the web app navigates to
`/playground/<name>`, while both Readymade shells browse their start page and
open it from there, which is the journey that reads the board back out of the
platform.

Services are addressed by the uuid in the board JSON (`service(page, uuid)` →
`#service-frame-<uuid>`), so selectors are stable without adding test ids to
the app.

Prefer boards that need no network: they run identically on all three profiles
and are the bulk of what is worth covering. Specs that need a real hkp-node go
in `tests/cloud/`, which the fast suite ignores.


## Diagnostics and controlled dependencies

The shared fixture listens before navigation on every page in its browser
context. Uncaught exceptions and unexpected application console errors fail an
otherwise passing test. Console errors, failed requests and HTTP error responses
are attached as `browser-diagnostics.json`; failing cloud tests also attach
runtime logs. URLs omit credentials, query strings and fragments; common bearer
and token strings are redacted. Use synthetic data: traces/screenshots and raw
local server logs are not general-purpose secret scrubbers.

HTTP errors and browser-generated resource messages are recorded, because
negative API journeys can intentionally produce them. They are not universally
asserted away: each journey must check its intended visible/API result.
Application console exceptions require a reviewed, per-spec message pattern via
`expectedConsoleErrors` or an `expected-console-error` annotation. Keep any
exception scoped to the affected journey and record its reason in the plan.
The send-ntfy input warnings and C++ handover close error are now fixed; their
exceptions have been removed. The reduce demo remains an existing expected
failure.

Browser HTTP/WebSocket traffic is restricted to the configured application
origin and explicitly declared `serverOrigins`. Unmocked HTTP dependencies get
503; unmocked WebSockets close with code 1008. Per-page routes take precedence,
so tests can supply controlled API responses. Service workers are blocked to
prevent interception from bypassing the routes. This controls browser traffic,
not arbitrary outbound traffic from real runtime services. Keep cloud boards
synthetic and free of messaging/model calls unless their server dependency is
also controlled. The WebRTC capability probe uses local peers and no STUN.

The optional face-video journey skips when `HKP_E2E_FACE_Y4M` is absent. When
specified, a missing file or invalid Y4M header fails configuration rather than
silently skipping. The fixture must contain a face; ntfy is mocked locally, and
the MediaPipe model/WASM assets are bundled with the application.
External model downloads receive the same browser guard as other dependencies:
a model-dependent journey needs bundled assets or an explicit local mock.

`fixture-contract.spec.ts` verifies mock precedence, diagnostic enforcement,
credential redaction, persistent native presets and cleanup failure handling.
Its injected browser exception is an intentional expected failure on each host:
if diagnostics stop enforcing it, the unexpected pass fails the suite.
`runtime-server.spec.ts` checks process startup failure and graceful cleanup
once on web; these process contracts are independent of desktop/mobile shells.


## PR and cloud CI

`.github/workflows/run-all-tests.yml` runs two E2E checks on pull requests,
main pushes and normal manual runs: **E2E browser** and **E2E Node cloud**.
Use those exact job names as required checks in the target branch's protection
settings after their first run. This change documents the checks; it does not
change repository protection rules. The existing C++/unit job stays on main
pushes and normal manual runs.

The workflow has read-only repository permissions, does not persist checkout
credentials, and cancels obsolete runs for the same PR/ref. The browser job
installs Chromium/WebKit; the cloud job installs Chromium and initializes only
`hkp-node` at the gitlink revision, without following a remote branch or pulling
the unrelated SSH submodules. Both use Node 22 and lockfile installs.

Cloud CI explicitly sets `HKP_E2E_CLOUD_TARGET=node`: six real Node/coordinator
journeys, with no C++ cases counted as skips. C++ and Python are not covered by
that required check. The local cloud default remains `all`, including C++ when
built. `HKP_E2E_REQUIRE_RT=1` makes a missing C++ binary fail configuration;
a supplied invalid `HKP_RT_BIN` also fails rather than falling back. Missing
Node checkout/dependencies always fail cloud configuration. The servers trust
only the configured localhost application origin in addition to their built-in
local/native origin policy. This lane still uses synthetic unsigned identities
with server authentication disabled; authenticated tests belong to milestone 4.

Every run writes `test-results/summary.json`. GitHub step summaries separate
executed/passed/expected-failure/failed/flaky/skipped counts and retries. CI
permits one retry for diagnostics, but `failOnFlakyTests` makes a passing retry
leave the job red. Failed jobs upload the HTML report and test-results directory
(traces, screenshots, video, browser diagnostics, summary and runtime logs) for
seven days. Use synthetic credentials/data; artifact retention is not a secret
scrubber. See the diagnostics section above.

To check uploads deliberately, dispatch the workflow with
`e2e_failure_probe=true` on a ref containing this workflow. It runs only the
Node cloud artifact probe and is supposed to fail. Download its
`e2e-node-cloud-failure-report` artifact and check the HTML report, trace,
screenshot, browser diagnostics and Node log. Locally, from `e2e/`:

```sh
HKP_E2E_CLOUD_TARGET=node HKP_E2E_FAILURE_PROBE=1 npm run test:cloud
CI=true HKP_E2E_CLOUD_TARGET=node HKP_E2E_FAILURE_PROBE=flaky npm run test:cloud
npm run test:reporter
```

The flaky probe fails on its first attempt, passes its retry, and must still
return a failing exit status under CI. Neither probe is discovered in normal
runs. `HKP_E2E_REQUIRE_FACE=1` makes the optional face journey mandatory: it
requires `HKP_E2E_FACE_Y4M` and rejects a missing/invalid camera fixture. The
standard PR checks intentionally leave this media-dependent journey optional.

The repository aggregate runner keeps browsers opt-in:
`./run-all-tests.sh --with-e2e` installs the extra dependencies/browsers and runs
both default and local cloud suites after the existing suites. Without the flag,
it runs the existing unit/runtime suites. Node 22 is required for this option.
