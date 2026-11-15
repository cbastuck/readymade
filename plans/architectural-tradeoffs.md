# Multi-target architecture trade-offs and hardening

Working document tracking the structural trade-offs of Readymade's inverted host
architecture (one React app in `hkp-frontend` + `meander/frontend` running
inside system webviews on macOS, Windows, Linux, iOS and Android over `hkp://`
and `saucer.exposed` beside an in-process `hkp-rt`) and the engineering measures
to close them.

See `docs/content/targets.md` for how the target architecture works today and
`architecture.md` in the repository root for the pitch brief.

**Status legend:** ☐ not started · ◐ in progress · ☑ done · ✎ needs design before build
**Effort legend:** S = under a day · M = 2–4 days · L = 1–2 weeks

---

## Where we stand

| ID | Trade-off / Finding | Affected targets | Effort | Status |
| --- | --- | --- | --- | --- |
| **T1** | Triplicated `hkp://` route implementations (C++, Swift, Kotlin) and contract drift against `fakeNativeHost.ts` | Desktop (`meander/backend`), iOS (`meander-ios`), Android (`meander-android`), `e2e/` | M–L | ✎ |
| **T2** | `meander/frontend` has no unit test suite (tested only via `tsc` and Playwright `fakeNativeHost`) | `meander/frontend` | S–M | ☐ |
| **T3** | Webview engine fragmentation (WebKit vs. WebKitGTK `bwrap` vs. Chromium WebView2 / Android WebView) | All native shells | M | ☐ |
| **T4** | Privileged bridge & frame isolation across 3 webview engines (`saucer.exposed`, `WKUserScript`, `addJavascriptInterface`) | Desktop, iOS, Android | M | ◐ |
| **T5** | Mobile embedded `hkp-rt` lifecycle, loopback proxy overhead, and Android native-service parity | iOS, Android, `hkp-rt` | L | ✎ |
| **T6** | Build-order sensitivity ("stale bundle trap") when building from Xcode or Android Studio | `meander-ios`, `meander-android`, `meander/frontend` | S | ☐ |

---

## 1. Triplicated `hkp://` routes and the fake-host contract gap (T1)

### The trade-off

Routing host capabilities through `fetch("hkp://…")` gives the React app a
single calling convention and lets Playwright test 95% of UI journeys against
`e2e/support/fakeNativeHost.ts` without booting native builds.

The cost is below the seam: every `hkp://` route family (`boards`, `history`,
`presets`, `secrets`, `remotes`, `settings`, `home-screen`, `share-files`) is
implemented **four times**:
1. C++ (`meander/backend/schemeHandler.cpp` + `router.cpp`) for desktop,
2. Swift (`WKURLSchemeHandler`) in `meander-ios`,
3. Kotlin (`AndroidHkpBridge` + injected `window.fetch` shim) in `meander-android`,
4. TypeScript (`e2e/support/fakeNativeHost.ts`) for E2E tests.

When one implementation diverges — such as `meander-ios` percent-decoding URL
paths twice while desktop and `fakeNativeHost.ts` decoded once
(`REVIEW-MOBILE-PARITY.md` #3) — the E2E suite stays green while the shipped app
breaks.

### Plan

1. **Shared `hkp://` contract test suite:**
   - Define a language-agnostic conformance vector (JSON fixtures of requests:
     method, percent-encoded URL with slashes/accents/spaces, headers, body, and
     expected status + response shape) covering `boards`, `history`, `presets`,
     `secrets` and `settings`.
   - Run the exact same vector against `fakeNativeHost.ts`, the C++
     `SchemeHandler` (in `meander/backend/tests/`), the Swift router, and the
     Kotlin router.
2. **Evaluate moving file-backed `hkp://` routes into C++:**
   - Both iOS and Android already link and run `hkp-rt` in-process (Objective-C++
     on iOS, JNI on Android). File-backed routes whose logic is pure filesystem
     work (`boards`, `history`, `presets`, `boardName.h` encoding) could live in
     a shared C++ host library called by all three shells, leaving only
     OS-specific APIs (Keychain/Keystore, Home Screen shortcuts, Share
     extensions) in Swift and Kotlin.

---

## 2. Missing unit test setup in `meander/frontend` (T2)

### The trade-off

`hkp-frontend` holds the core engine and has an extensive Vitest suite.
`meander/frontend` wraps `hkp-frontend` with the native start page, library
migration (`migrateLocalBoards`), unified board deletion (`deleteSavedBoard`),
iCloud vs. local history keying, and `MobileApp.tsx`.

As noted in `REVIEW-MOBILE-PARITY.md` (#4, #6, #7, #12), `meander/frontend`
currently has **no unit test runner**, so logic in that wrapper is verified only
by `tsc` or full Playwright runs.

### Plan

- Add a lightweight Vitest setup to `meander/frontend/package.json` (matching
  `hkp-frontend`) and wire it into `./run-all-tests.sh`.
- Add unit tests for `deleteSavedBoard`, `migrateLocalBoards`, `usePins`, and
  library-scoped history (`?library=icloud`).

---

## 3. Webview engine fragmentation across OSes (T3)

### The trade-off

Using system webviews via `saucer`, `WKWebView` and Android `WebView` avoids
shipping a 150+ MB Chromium bundle, but means the app runs on three distinct
browser engines with different platform constraints:

- **macOS & iOS (`WKWebView`):** Blocks mixed content and cross-origin `fetch()`
  from custom schemes (`hkp://app` → `http://127.0.0.1`), and iOS periodically
  terminates and reloads the WebContent process under memory pressure (requiring
  `WKUserScript` re-injection of the vault and grants).
- **Linux (`WebKitGTK 6.0`):** Uses `bwrap` user namespaces for its sandbox,
  which Ubuntu 24.04+ blocks by default via AppArmor
  (`kernel.apparmor_restrict_unprivileged_userns=1`), causing launch failures
  unless the user configures AppArmor or sysctl (`README-linux.md`).
- **Windows (`WebView2`) & Android (`WebView`):** Chromium-based, but Android's
  `WebView` cannot run `fetch()` against custom URL schemes natively, requiring
  a monkey-patched `window.fetch` bridge.

### Plan

- **Linux packaging:** Ship an AppArmor profile or pre-flight check script in
  Linux packages (`.deb` / AppImage launcher wrapper) that detects the Ubuntu
  24.04+ `bwrap` userns restriction and gives a clear actionable message instead
  of a raw GTK/dbus-proxy crash.
- **iOS WebContent reload resilience:** Add an automated test / smoke check
  simulating `webViewWebContentProcessDidTerminate` to verify that injected
  state (vault, grants, platform markers) and active board state recover
  cleanly.

---

## 4. Privileged bridge and frame isolation (T4)

### The trade-off

Unlike a standard browser tab, a native webview holds privileged bridges to the
OS (`window.saucer.exposed` on desktop, `WKURLSchemeHandler` / `WKUserScript` on
iOS, `addJavascriptInterface` on Android). Because webview engines often expose
message handlers or custom schemes to subframes as well as the main frame, any
untrusted iframe or accidental navigation inside the webview is a potential
privilege escalation vector.

### Current state & remaining work

- Desktop navigation and file-grant boundaries are enforced and tested in
  `meander/backend/pageTrust.h` (`REVIEW-V1-E2E-SECURITY.md` #3).
- iOS and Android guard `hkp://secrets` and `AndroidHkpBridge` with per-launch
  tokens (`X-Hkp-Secrets-Token`, `BridgeToken`) injected only into the main
  frame (`REVIEW-MOBILE-PARITY.md` #1, #14).
- **Still open:** On-device verification (M3 in `REVIEW-MOBILE-PARITY.md`) and a
  single documented security checklist in `docs/content/targets.md` that every
  new `hkp://` route or native bridge must satisfy before merge.

---

## 5. Mobile embedded `hkp-rt` constraints and parity (T5)

### The trade-off

1. **In-memory vs. loopback transport:** On the desktop, requests to
   `hkp://remotes/embedded` are handed directly to the in-process C++ server
   with no socket (`meander/backend/schemeHandler.cpp`). On iOS and Android, the
   embedded `hkp-rt` binds a loopback port (`127.0.0.1:5556`) and the shell
   proxies HTTP calls to it.
2. **OS suspension:** Mobile OSes suspend backgrounded apps, which is why phone
   embedded runtimes cannot join a coordinator (`docs/content/concepts/remotes.md`).
3. **Hardware service parity:** iOS registers Objective-C++ services for device
   motion, location, microphone and speaker in `hkp-rt`; Android's JNI shim does
   not implement those native services yet (`meander-android/README.md`).

### Plan

- Evaluate routing `hkp://remotes/embedded` on iOS and Android through the same
  in-memory C++ request dispatcher the desktop uses (`hkp_runtime_jni.cpp` /
  `HKPRuntimeHost.mm`), avoiding loopback TCP port collisions when external
  LAN access is off.
- Track Android native sensor/audio service parity with iOS as a dedicated
  milestone once `TODO-MOBILE-PARITY.md` lands.

---

## 6. Build-order sensitivity for bundled web assets (T6)

### The trade-off

Decoupling the Vite build from the CMake/Xcode/Gradle build makes dev-server UI
iteration fast, but creates a release-packaging trap when building directly from
Xcode or Android Studio (`README-ios.md`, `README-android.md`):
- Building the Xcode or Android Studio target does not run `npm run build:ios`
  or `npm run update:android`.
- On iOS, CMake globs `ReadymadeIOS/Resources/WebApp` at configure time, so a
  developer building from Xcode without running `./build-ios.sh` can package a
  stale UI bundle.

### Plan

- Add a pre-build phase / Gradle task (or a staleness check comparing a hash of
  `hkp-frontend/src` + `meander/frontend/src` against a stamp file in `WebApp/`)
  in `meander-ios/CMakeLists.txt` and `meander-android/app/build.gradle.kts`
  that either runs the frontend bundle step automatically in Release builds or
  fails the build with a clear message when `WebApp/` is stale or missing.
