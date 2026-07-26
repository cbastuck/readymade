# Building Readymade on MacOS

Instructions for building the desktop app on MacOS.
See [README.md](./README.md) for prerequisites shared by all platforms.

For the iOS app, see [README-ios.md](./README-ios.md) — it is built on MacOS, but from
`meander-ios/` and separately from the desktop build.

## Prerequisites

- CMake 3.21+
- Node.js + npm
- Xcode Command Line Tools

## Build (recommended)

From the repository root:

```bash
./build.sh
```

This does the following:

1. Builds the web app in `meander/frontend` (`npm run build`)
2. Configures CMake in `build/` (first run only)
3. Builds the CMake project and the `Readymade` app target

The build script also enables local vcpkg binary/download caching under `.cache/vcpkg/` by
default, so repeated builds reuse prebuilt dependency artifacts instead of rebuilding large
ports (for example Boost).

If you want to use a shared binary source (for example a CI-provided cache), set
`VCPKG_BINARY_SOURCES` before running the build script.

### Build configuration

Default configuration is `Release`.

```bash
./build.sh Debug
```

To build for dev-server mode (no embedded frontend), use `./build.sh Debug OFF` on a clean
`build/` directory. See [Frontend dev server](./README.md#frontend-dev-server).

## Manual build example

Example `Release` build from repo root:

```bash
cmake -S . -B build -DMEANDER_USE_EMBEDDED_FRONTEND=ON
cmake --build build --target Readymade --config Release
```

## Output

The app bundle is produced under `build/meander/<CONFIG>/`.

For example, a `Debug` build produces:

```text
build/meander/Debug/Readymade.app
```

## Rebuild from scratch

If you need a clean configure/build:

```bash
rm -rf build
./build.sh
```
