# Architecture and Targets

One web app, four hosts. What the app *is*, how it reaches the machine it runs
on, and what each target adds.

---

## The shape

Readymade is a **web app that ships inside native applications**. Not a web app
with a native version, and not a native app with some web views in it: there is
one React app holding the board engine, the services and the whole interface,
and each native target is a **host** that serves that app and answers a protocol
it calls.

```
                  ┌────────────────────────────────────────┐
                  │   board engine + UI  (React, one impl) │
                  │   hkp-frontend  ·  meander/frontend    │
                  └───────────────────┬────────────────────┘
                                      │  PlatformCapabilities
                                      │  (every member optional)
      ┌───────────────┬───────────────┴───────────────┬───────────────┐
      │               │                               │               │
 browser tab    saucer webview                   WKWebView      Android WebView
      —          + C++ backend                   + Swift app    + Kotlin app
   nothing          DESKTOP                          iOS            ANDROID
   below it   macOS · Windows · Linux            phones and tablets
```

This is a less usual arrangement than it looks, and it is worth being explicit
about what it buys, because the obvious alternatives were the other way round:

- **A native UI per platform, over a shared core.** Then the board editor — the
  most intricate part of the product — exists three times, and a service's panel
  has to be written three times to be usable everywhere.
- **A web app per platform.** Then the engine forks, and a board saved on one
  stops being the same document on another.

Here the interface and the engine are written **once**, and what varies is a
seam a few hundred lines wide. A service written today runs on the web, on a
desktop, and on a phone without knowing which it is on. The cost is paid in one
place: the app cannot call the operating system directly, so everything the
machine can do that a browser cannot has to arrive through a protocol.

The saving compounds on the desktop, where **one shell covers macOS, Windows and
Linux**. The Readymade desktop app is a single C++ backend built three ways:
saucer wraps whichever webview the system already has — WebView2 on Windows,
WebKitGTK on Linux, WKWebView on macOS — so the same app runs on all three
without a per-system interface. Counted by operating system rather than by host,
one web app reaches five: those three, plus iOS and Android, plus any browser.

---

## How the app reaches its host

Two surfaces, and keeping them apart matters because they are not equally
available:

```
 the app calls                             answered by
 ───────────────────────────────────────   ────────────────────────────────────────
 fetch("hkp://boards/my-board")            desktop   SchemeHandler → Router   (C++)
   the host's own data:                    iOS       WKURLSchemeHandler       (Swift)
   boards, remotes, settings, history      Android   fetch() shim → JS bridge (Kotlin)
                                           web       nobody — the call is never made

 window.saucer.exposed.pickFile()          desktop   a bound C++ function
   direct calls into the backend:          elsewhere absent — code checks first
   file dialogs, the secret vault
```

**`hkp://` is a protocol, not a file path.** It looks like an HTTP request and
is written like one — `GET hkp://boards/`, `POST hkp://settings` — but it never
reaches a network. Each shell answers it in its own language: the desktop routes
it through a C++ router, iOS registers a `WKURLSchemeHandler` on the `hkp`
scheme, and Android has no scheme-handler API at all, so it **replaces
`window.fetch`** in an init script and forwards anything starting with `hkp://`
to a Kotlin object over the JS bridge.

That difference is the argument for a protocol rather than direct bindings.
Direct calls into native code exist on exactly one platform — saucer's
`exposed`, on the desktop — while a fetch-shaped surface can be implemented on
every webview, in any language, and stood in for by a fake in tests. It also
gives the app one calling convention instead of one per host, which is why most
of what the shells provide arrived as `hkp://` routes rather than as bindings.

The scheme carries the app itself on iOS: the webview loads
`hkp://app/index.html`, so the bundle and the host's data come through the same
door. The desktop serves the built frontend from its own local server instead,
and in development points at Vite (`MEANDER_USE_EMBEDDED_FRONTEND=OFF`).

---

## The runtime is addressed the same way, near or far

The most useful consequence of the arrangement: **a board does not know whether
the runtime it uses is on another machine or inside the app it is running in.**

```
 a board on the web
     browser ──────── http + ws ────────▶ hkp-node on some host

 the same board in the app
     web app ── hkp://remotes/<name> ──▶ the shell ──▶ hkp-rt, in this process
                                             │
                                             ├── desktop      handed straight to the
                                             │                in-process server, no socket
                                             └── iOS/Android  forwarded over loopback,
                                                              http://127.0.0.1:<port>
```

Both are the same REST + WebSocket protocol, so nothing above the seam changes.
On the desktop the shell synthesises a request and hands it to the embedded
runtime directly, so the call never becomes a socket at all. On iOS and Android
the embedded runtime does listen on a loopback port, and the shell forwards to
it — a proxy rather than a direct `fetch`, because a page served from a `hkp://`
origin reaching `http://127.0.0.1` is a cross-origin request the webview would
refuse.

The address a board carries is `hkp://remotes/<name>`, which resolves to
whatever this app embeds. A name that is not this app's own is refused rather
than quietly served by whichever runtime is present — see
`concepts/runtime.md`.

---

## The seam, precisely

`PlatformCapabilities` (`hkp-frontend/src/platform/PlatformContext.tsx`) is
where all of this meets the app, and **every member is optional**. That is the
design rather than an oversight: on the web nothing supplies it, so a capability
that is absent is a feature that does not appear, not an error to handle. The
native shells fill it in through `MeanderPlatformProvider`.

So the rule for anything new: if it needs the machine, it belongs behind this
seam and reaches the host as an `hkp://` route — and the web target has to keep
working with it missing.

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

The seam is `PlatformCapabilities`, described above: saving a board to disk,
picking a file, minting a scoped runtime token, restoring a session — each is
present or absent, and the app is written to read that. What differs per target
is which of the **two surfaces** is there to fill it in:

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
