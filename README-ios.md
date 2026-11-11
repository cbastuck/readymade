# Building Readymade for iOS (device + simulator)

The iOS app (`meander-ios/`) embeds `hkp-rt` as an in-process C++ runtime and loads the mobile web app (`meander/frontend`) inside a `WKWebView`. It is built on macOS separately from the desktop build.

## Prerequisites

- macOS with Xcode (full installation)
- CMake 3.21+
- Node.js + npm
- For physical devices: an Apple Developer Program account (see [Signing & multicast entitlement](#signing--the-multicast-entitlement-real-devices))

## Build (recommended)

From the repository root, `build-ios.sh` builds the mobile web app (`npm run build:ios`), configures CMake with the vcpkg toolchain, and builds `ReadymadeIOS`:

```bash
./build-ios.sh device           # or: ./build-ios.sh simulator
# optional 2nd arg: Release (default) | Debug | RelWithDebInfo | MinSizeRel
```

### Building from Xcode / CMake presets directly

If you generate the Xcode project manually instead of using `./build-ios.sh`:

```bash
cd meander/frontend && npm run build:ios && cd ../..
cmake --preset ios-device       # or ios-simulator
cmake --build build/meander-ios-device --config Release
```

> **Important when building from Xcode:** On physical devices (and any Release build), the app uses the bundled web assets in `meander-ios/ReadymadeIOS/Resources/WebApp`. Building the Xcode target alone does **not** rebuild `meander/frontend`. Always run `npm --prefix meander/frontend run build:ios` **before** building in Xcode so CMake's `CONFIGURE_DEPENDS` glob picks up the fresh bundle. (The simulator in Debug mode uses `DEV_WEBAPP_URL` on port `8555` instead.)

## Signing & the multicast entitlement (real devices)

LAN discovery uses multicast sockets, which require Apple's `com.apple.developer.networking.multicast` entitlement (declared in `meander-ios/ReadymadeIOS/Resources/ReadymadeIOS.entitlements`). For a physical device build:

1. Register the App ID (`com.readymadeit.app-ios`) in the Apple Developer portal and enable **Multicast Networking**.
2. Sign with a provisioning profile that includes the capability.

Verify the signed bundle carries the entitlement:

```bash
codesign -d --entitlements - /path/to/ReadymadeIOS.app
# expect: com.apple.developer.networking.multicast = true
```

The iOS Simulator does not require this entitlement.

## Output

```text
build/meander-ios-device/ReadymadeIOS.xcodeproj     # and built .app alongside
build/meander-ios-simulator/ReadymadeIOS.xcodeproj
```
