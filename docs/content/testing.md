# Testing

What runs where — the per-area suites that check the parts, and the end-to-end suite that checks the thing a person actually touches.

---

## Two layers, two different questions

The suites answer different questions, and knowing which is which saves writing
a test in the wrong place:

| | Asks | Runs in | Takes |
|---|---|---|---|
| **Per-area suites** | Does this part behave? | its own process — jsdom, pytest, ctest | seconds to a couple of minutes |
| **End-to-end** | Does the app a person opens work? | a real browser, on each host it ships inside | minutes |

A rule that follows: anything expressible without a browser belongs in a
per-area suite, because that is where a failure names the function that broke.
The end-to-end suite is for what only exists once everything is assembled — a
board opening, a shell mounting, a pipeline actually running.

---

## The per-area suites

`run-all-tests.sh` at the root runs all six, in order:

| Area | Framework | Its own command | What it holds |
|---|---|---|---|
| hkp-python | pytest | `./run_tests.sh` | runtime, services, auth, mounts, the board log |
| hkp-node | vitest | `npm test` | the same ground, plus the coordinator and its stores |
| hkp-rt | Catch2 + ctest | `./run-tests.sh` | the C++ runtime and its services |
| Readymade app backend | Catch2 | `./run-tests.sh` | the desktop shell's rules — routing, settings, grants, the share inbox |
| hkp-frontend demo boards | vitest | `npm run test -- src/runtime/browser/tests/demo-boards.regression.test.tsx` | every board in `hkp-frontend/boards/`, checked against the registry |
| hkp-frontend | vitest | `npm run test -- --exclude …` | everything else in the frontend |

Two things about the runner are deliberate. It **does not stop at the first
failure** — it records a pass or fail per suite and prints the table at the end,
so one run tells you everything that is broken rather than the first thing. And
each suite is also runnable on its own, from its own directory, which is what
you want while working inside one.

The desktop backend's suite is built **without saucer, vcpkg or hkp-rt** on
purpose: it covers rules the backend keeps apart from its webview-facing code,
so it compiles in seconds instead of requiring a full app build. That separation
is the reason those rules have tests at all.

`run-all-cpp-tests.sh` is the C++ half on its own, against an existing `./build`.

---

## End-to-end

`e2e/` holds one Playwright suite that drives the **same webapp as each of the
hosts it ships inside**:

| Project | App | Engine | Platform host |
|---|---|---|---|
| `web` | `hkp-frontend` | Chromium | none — signed out, no capabilities |
| `desktop` | `meander/frontend` | Chromium | fake saucer + `hkp://` scheme |
| `mobile` | `meander/frontend` | WebKit, iPhone descriptor | the same fake, mounting `MobileApp` |

```
cd e2e
npm install && npx playwright install chromium webkit
npm test                 # all three profiles
npm run test:desktop     # one of them
npm run test:ui          # pick, watch, time-travel
npm run report           # the last run
```

The dev servers start themselves (`webServer` in `e2e/playwright.config.ts`) and
an already-running one is reused, so a `vite` you already have is picked up
rather than fought over.

A profile is a **host**, not a screen size. `mobile` runs WebKit on an iPhone
device descriptor because that is what the iOS app is — a WKWebView with real
touch — and the shell has gesture code that a synthetic click would skip
entirely. Writing a spec once and telling it which host it is on is what keeps
three targets from becoming three suites.

### Standing in for the native side

`e2e/support/fakeNativeHost.ts` implements both surfaces the Readymade shells
reach the platform through: `window.saucer.exposed.*` (file dialogs, the secret
store) and `fetch("hkp://…")` (boards, remotes, settings, the start-page tree).

Two consequences worth knowing before writing a spec:

- **It is installed as a page init script, and has to be.** The app decides what
  host it is on *while its modules evaluate* — `isMeanderApp()` memoises a single
  `hkp://boards/` probe, and `MeanderPlatformProvider` reads `saucer.exposed` at
  module scope. Anything installed after the first navigation produces a
  confusing half-native app rather than a clean failure.
- **`page.route` cannot serve any of it.** `hkp://` is not http, so it never
  reaches Playwright's proxy; wrapping `window.fetch` is the only way in.

What the host was asked to store is mirrored on `window.__HKP_FAKE_HOST__` and
reachable through the `hostState()` fixture, so a spec can assert on what the app
handed the platform rather than only on what the UI shows.

**The blind spot is the boundary itself.** Rename a `saucer.exposed` function or
change an `hkp://` route and this suite stays green while the shipped app
breaks. The fake is written against `BackendAdapter`, so TypeScript catches a
changed *shape* — a changed *route* needs a manual pass, in the style of the
per-change checklists kept in `TODO-TEST.md`.

### The shipped-board sweep

`e2e/tests/smoke/shipped-boards.spec.ts` opens every browser-only board in
`hkp-frontend/boards/` and asserts that each service it declares renders a frame,
with no uncaught exception. `web` profile only — it asks about board JSON, not
about a host.

The bug it exists for is **drift**: when a board names a `serviceId` the registry
no longer has, `createService` logs an error and returns null, so the board still
opens looking fine, minus a piece. Nobody notices, including a person opening it
casually. Hence an assertion per declared uuid rather than "the page rendered".

It deliberately does not claim those boards *work* — many want a camera, a key or
a network — only that every part they are made of still exists. Boards with a
`rest` runtime are excluded, since a sweep has no business starting an hkp-node.
Known-broken boards are listed with a reason and marked `test.fail()` rather than
skipped: a listed board is *expected* to fail, so fixing one turns the run red
until its entry is removed. That is the only way a known failure ever gets
cleaned up.

### Two checks on the same anxiety

Board drift is covered twice, at different depths, and both are worth keeping:

| | `demo-boards.regression.test.tsx` (vitest) | `shipped-boards.spec.ts` (Playwright) |
|---|---|---|
| Where | jsdom, no browser | the real app in a real browser |
| Asserts | the JSON is a valid descriptor, ids and uuids are unique, every browser `serviceId` resolves in the registry, and the board restores through `BoardProvider` | every declared service actually renders, and nothing threw |
| Costs | seconds | about a minute |

The first fails with the name of the service that went missing; the second
catches what only appears once a board is really mounted.

### Capability checks

`e2e/tests/capabilities/` holds environment probes rather than product tests —
things the real specs stand on, worth failing in isolation instead of inside a
board. `webrtc.spec.ts` establishes a data channel between two browser contexts
with no signalling server, and is why `CHROMIUM_ARGS` exists: without
`--disable-features=WebRtcHideLocalIpsWithMdns`, Chrome hands out `.local`
candidates that two isolated contexts cannot resolve for each other, and pairing
never completes — silently.

### After a failure

`trace: retain-on-failure` means the failing run was already recorded:
`npx playwright show-trace <path>` replays it step by step with DOM snapshots,
including for a run that failed elsewhere. There is no need to reproduce it
first. `e2e/README.md` covers the ways of watching a run live.

---

## What CI runs

`.github/workflows/run-all-tests.yml` checks out with `submodules: false` and
runs **hkp-rt and hkp-frontend only** — the in-tree parts. That is the repository
split showing through: the submodules answer for themselves, and a superproject
workflow that cloned them would be testing whatever commit they happened to be
on. See [Repository](./repository.md).

So two things are *not* behind the green tick, and both are worth knowing before
trusting it:

- **hkp-node and hkp-python**, whose suites run in their own repositories and in
  `run-all-tests.sh` locally;
- **the end-to-end suite**, which is not wired into a workflow yet — it is run
  locally today. The config already reads `process.env.CI` (retries, workers,
  `forbidOnly`, the GitHub reporter), so the suite is ready for a workflow that
  does not exist yet.

---

## Where it lives

| Concern | Where |
|---|---|
| Every suite in one run | `run-all-tests.sh` |
| The C++ suites alone | `run-all-cpp-tests.sh` |
| End-to-end suite, profiles, dev servers | `e2e/playwright.config.ts`, `e2e/README.md` |
| Fake platform host | `e2e/support/fakeNativeHost.ts`, `e2e/support/test.ts` |
| Board drift, without a browser | `hkp-frontend/src/runtime/browser/tests/demo-boards.regression.test.tsx` |
| Board drift, in a browser | `e2e/tests/smoke/shipped-boards.spec.ts` |
| What CI covers | `.github/workflows/run-all-tests.yml` |
| Why CI covers only part of it | [Repository](./repository.md) |
| Manual checklists for a change | `TODO-TEST.md` |

---

See also: [Repository](./repository.md) for why the split between in-tree and
submodule decides what CI covers.
