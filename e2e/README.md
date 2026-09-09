# End-to-end tests

One suite, driving the same webapp as each of the hosts it ships inside.

```
npm install
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

### What this does and does not cover

It covers everything above the platform boundary, given a conforming host. It
does not cover the boundary itself: rename a `saucer.exposed` function or
change an `hkp://` route and this suite stays green while the shipped app
breaks. The fake is written against `BackendAdapter`, so TypeScript catches a
changed shape — but a changed *route* needs the per-host smoke checklist, in
the style of `TODO-TEST.md`.

The fake is also useful outside the tests: it runs the desktop UI in a plain
browser with a working board library, no saucer build needed.

## The shipped-board sweep

`tests/smoke/shipped-boards.spec.ts` opens every browser-only board in
`hkp-frontend/boards/` and asserts that each service it declares renders a
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
and are the bulk of what is worth covering. Specs that need a real hkp-node
belong in their own tagged group so the fast suite stays fast.
