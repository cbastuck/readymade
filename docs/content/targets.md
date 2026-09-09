# Targets

One board engine, four hosts. What each target *is*, what a board may assume on
it, and what building it produces.

---

## The same app, four ways to run it

A board is not built once per platform. Every target runs the same React app and
the same board engine; what changes is what surrounds it — whether a native host
is there at all, and whether a C++ runtime is embedded beside it.

| Target | The shell | Web app it runs | Built by | Produces |
|---|---|---|---|---|
| **Web** | none — a browser tab | `hkp-frontend` | `npm run build` | a static bundle |
| **Desktop** (macOS, Windows, Linux) | saucer webview, C++ backend | `meander/frontend` | `build.sh`, `build-linux.sh`, `build-windows.ps1` | an app bundle / executable |
| **iOS** | `WKWebView`, Swift | `meander/frontend` | `build-ios.sh` | `ReadymadeIOS.xcodeproj`, built in Xcode |
| **Android** | Android WebView, Kotlin | `meander/frontend` | `build-android.sh` | an `.apk` under `app/build/outputs/apk/` |

The web target is the odd one and the important one: it has no shell, no CMake
and no native toolchain — Node and a browser are the whole prerequisite. It is
also where the playground lives, so it is the target most people meet first.

The three native targets share `meander/frontend`, one app deciding at startup
which host it is on rather than three apps. `isMeanderApp()` probes
`hkp://boards/` once; `main.tsx` swaps the root component to `MobileApp` when
the host is a phone.

---

## What a target actually decides

Two things, and it is worth keeping them apart, because they fail differently.

### 1. Whether there is a platform host

`PlatformCapabilities` (`hkp-frontend/src/platform/PlatformContext.tsx`) is the
seam. **Every member is optional**, and that is the design: on the web nothing
supplies it, so a capability that is not there is a feature that does not
appear, not an error to handle. Saving a board to disk, picking a file, minting
a scoped runtime token, restoring a session — each is present or absent, and the
app is written to read that.

The native shells fill it in through `MeanderPlatformProvider`, over two
surfaces that are **not** both present everywhere:

- `fetch("hkp://…")` — the things the host stores (`hkp://boards/`,
  `hkp://remotes/`, `hkp://settings`). Served by all three shells; Android
  routes the scheme through JS bridges installed in `MainActivity.kt`.
- `window.saucer.exposed.*` — direct calls into the C++ backend. **Desktop
  only**: saucer is not built for iOS (`BUILD_HKP_SAUCER=OFF`) and Android does
  not use it. Code reaching for it checks first, which is why the secrets path
  can say "this build cannot store secrets" rather than fail.

Anything reached either way exists only inside a shell.

### 2. What is compiled into the embedded runtime

Desktop, iOS and Android all embed `hkp-rt`, so a board can use C++ services with
no server. What they embed is not the same, and `3rdparty/CMakeLists.txt` decides
it by platform:

| Flag | Desktop | iOS / Android | What it embeds |
|---|---|---|---|
| `HKP_SPEECH_ENABLED` | ON | OFF | sherpa-onnx — local speech-to-text and text-to-speech |
| `HKP_INFLECT_ENABLED` | ON | OFF | the inflect TTS pipeline |
| `HKP_LLAMA_ENABLED` | ON | OFF | llama.cpp — local text generation |

Each defaults `OFF` under `if(IOS OR ANDROID)` and `ON` everywhere else — a
phone gets the runtime without the model weights and the megabytes behind them.
The consequence for a board is narrower than it sounds: the service ids are the
same on every target, so what changes is which *backend* a service can be set
to. A board that wants a local model on desktop and a server on a phone changes
a setting, not its shape.

`MEANDER_USE_EMBEDDED_FRONTEND` is the other build-time switch: `ON` bakes the
built frontend into the app, `OFF` points the shell at the Vite dev server on
port 8555 — which is how UI iteration on a native shell is done without
rebuilding it.

---

## What each host adds

Beyond the platform seam, each shell brings things a browser cannot:

| | Web | Desktop | iOS | Android |
|---|---|---|---|---|
| Boards on disk (`hkp://boards/`) | — | yes | yes | yes |
| Embedded `hkp-rt` | — | yes | yes | yes |
| Local model backends | — | yes | — | — |
| Secret store, with a consent prompt | — | yes | — | — |
| Share into the app | — | yes | yes | — |
| LAN discovery (`_readymade._tcp`) | — | yes | yes | yes |

The pattern in that table is worth reading. What lives *in the runtime* reaches
every target that embeds it: discovery is one implementation
(`hkp-rt/lib/src/discovery/discovery.cpp`) and needs only a platform
declaration per shell — iOS names the service in `Info.plist`, which the OS
requires before a process may browse for it. What lives *in a shell* reaches
only that shell: the secret vault is the desktop backend's
(`meander/backend/vault.h`), behind `saucer.exposed`, so it stops at the
desktop. And what the platform defines itself has to be written per platform —
sharing is a macOS app extension (`meander/backend/shareRouter.cpp`) and an iOS
Share Extension (`meander-ios/ReadymadeIOS/ShareExtension/`), which is why it
exists on two targets rather than four.

The code is the authority on this table. It is a summary of what is built today,
and the flags above move faster than prose.

---

## Which target to develop against

- **The web target**, unless you need something it cannot do. It has the
  fastest loop by a wide margin and no toolchain.
- **A native target** when the change touches the platform seam — file access,
  secrets, sharing, discovery, the embedded runtime, or anything behind
  `hkp://`. Those paths do not exist on the web, and a change to them cannot be
  seen there.

The end-to-end suite is organised the same way: its three profiles — `web`,
`desktop`, `mobile` — are *hosts*, not screen sizes, and the `desktop` and
`mobile` profiles stand in for the native surfaces with a fake. See
[Testing](./testing.md).

---

## Where it lives

| Concern | Where |
|---|---|
| Web target, dev server, routes | `README-web.md` |
| Per-platform build guides | `README-macos.md`, `README-windows.md`, `README-linux.md`, `README-ios.md`, `README-android.md` |
| Feature flags per platform | `3rdparty/CMakeLists.txt` |
| Embedded-frontend switch | `meander/CMakeLists.txt` |
| The platform seam | `hkp-frontend/src/platform/PlatformContext.tsx` |
| What the shells implement | `meander/frontend/src/platform/MeanderPlatformProvider.tsx`, `meander/frontend/src/backend/meander.ts` |
| Which host the app is on | `meander/frontend/src/isMeanderApp.ts` |

---

See also: [Repository](./repository.md) for which of these directories is a
submodule and what follows from that, and [Testing](./testing.md) for how the
same targets are covered by the suites.
