# Building Readymade on macOS

Instructions for building the native macOS desktop app (`Readymade.app`), which embeds the `hkp-rt` C++ runtime and the frontend UI.

For the iOS app (also built on macOS), see [README-ios.md](./README-ios.md).

## Prerequisites

- CMake 3.21+
- Node.js + npm
- Xcode Command Line Tools
- `git` on `PATH` (if `3rdparty/vcpkg` is missing, `build.sh` clones the pinned baseline and bootstraps it automatically)

## Build (recommended)

From the repository root:

```bash
./build.sh
```

This builds `meander/frontend`, configures CMake in `build/` (using local vcpkg caching under `.cache/vcpkg/`), and builds the `Readymade` target in `Release` mode. Set `VCPKG_BINARY_SOURCES` beforehand if you want to use a shared binary cache.

### Build options

```bash
./build.sh Debug        # Debug build with embedded frontend
./build.sh Debug OFF    # Debug build using the Vite dev server (run on a clean build/ dir)
```

See [Frontend dev server](./README.md#frontend-dev-server) for running the live UI server on port `8555`.

### Manual CMake build

```bash
cmake -S . -B build -DMEANDER_USE_EMBEDDED_FRONTEND=ON
cmake --build build --target Readymade --config Release
```

## Output

```text
build/meander/<CONFIG>/Readymade.app
```

## Rebuild from scratch

```bash
rm -rf build
./build.sh
```
