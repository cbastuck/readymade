# Building Readymade for iOS (device + simulator)

The iOS app (`meander-ios/`) embeds `hkp-rt` as a native runtime and loads the
hkp-frontend web app inside a `WKWebView`. It is built from `meander-ios/`
(the Xcode generator), separately from the desktop build.

It is built **on macOS** — see [README-macos.md](./README-macos.md) for the host toolchain,
and [README.md](./README.md) for prerequisites shared by all platforms.

## Prerequisites

- CMake 3.21+
- Node.js + npm
- Xcode (full install, not just the Command Line Tools)
- For real devices: an Apple Developer Program account — see
  [Signing & the multicast entitlement](#signing--the-multicast-entitlement-real-devices)

## Build

**One-shot build (recommended)** — from the repo root, `build-ios.sh` builds the
mobile web app, configures with the vcpkg toolchain, and builds the
`ReadymadeIOS` target in one go:

```bash
./build-ios.sh device           # or: ./build-ios.sh simulator
# optional 2nd arg: Release (default) | Debug | RelWithDebInfo | MinSizeRel
# output: build/meander-ios-device/ReadymadeIOS.xcodeproj  (built .app alongside)
```

**Generate-and-open in Xcode** — if you'd rather just generate the project and
build/sign interactively in Xcode, use the CMake presets from `meander-ios/`:

```bash
cmake --preset ios-device       # or ios-simulator
cmake --build build/meander-ios-device --config Release
# then open build/meander-ios-device/ReadymadeIOS.xcodeproj to run/sign on a device
```

(`build-ios.sh` runs `build:ios` for you; with the preset route you must refresh
the bundled web app yourself — see the next section.)

## ⚠️ Refresh the bundled web app before every device build

This is the easiest mistake to make. On **device** (and any Release build), the
app bundles the web app instead of using the dev server, and **building the iOS
app does not rebuild the frontend**. If you forget, you ship a stale UI.

Before building the iOS app for a device, run:

```bash
cd meander/frontend
npm run build:ios
```

`build:ios` (`tsc -b && vite build --config vite.config.ios.ts`) writes the
build **directly** into `meander-ios/ReadymadeIOS/Resources/WebApp`
(`vite.config.ios.ts` sets `outDir` there with `emptyOutDir: true`), which the
iOS CMake target globs (`CONFIGURE_DEPENDS`) into Copy Bundle Resources.
(`npm run update:ios` is an alias for `build:ios`. The old `copy-to-ios.sh` was
removed — it copied the stale desktop `dist/`, clobbering the fresh build.)

**Order matters:** run `npm run build:ios` **before** the CMake/Xcode build, not
during it. Vite emits content-hashed filenames and `emptyOutDir` rewrites the
folder each run; CMake resolves the resource glob at _configure_ time, so a
frontend build that runs mid-Xcode-build would bundle stale/missing files.
Running it first lets `CONFIGURE_DEPENDS` re-glob the fresh files on the next
build. (Automating this as part of the iOS build is a TODO.)

The **simulator** dev flow is unaffected: it uses `DEV_WEBAPP_URL` (the live Vite
dev server on `:8555`), so the bundled `WebApp` only matters for device/Release.

## Signing & the multicast entitlement (real devices)

LAN discovery uses raw multicast sockets, which require Apple's
`com.apple.developer.networking.multicast` entitlement. It is already declared in
`meander-ios/ReadymadeIOS/Resources/ReadymadeIOS.entitlements` and wired via
`XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS`. For a device build you must:

1. Register the App ID (`com.readymadeit.app-ios`) in the Apple Developer portal
   and enable the **Multicast Networking** capability on it (requires the
   approved entitlement + a paid Developer Program account).
2. Build/sign with a provisioning profile that includes it (automatic signing
   with your Team selected works once the capability is enabled on the App ID).

Verify the signed app actually carries it:

```bash
codesign -d --entitlements - /path/to/ReadymadeIOS.app
# expect: com.apple.developer.networking.multicast = true
```

The iOS Simulator is permissive about multicast and does not need the
entitlement; a physical device does.

## Output

The Xcode project and the built `.app` are produced under
`build/meander-ios-device/` (or `build/meander-ios-simulator/`).
