# hkp Build Guide

Quick instructions for building the project from the repository root.

To build for dev-server mode (no embedded frontend) with the script, use `./build.sh Debug OFF` on a clean `build/` directory.

## Prerequisites

- macOS with Xcode Command Line Tools installed
- CMake 3.21+
- Node.js + npm

Note: vcpkg is vendored in `3rdparty/vcpkg` and is used by CMake during configure/build.

## Build (recommended)

From the repository root:

```bash
./build.sh
```

This does the following:

1. Builds the web app in `hkp-saucer/frontend` (`npm run build`)
2. Configures CMake in `build/` (first run only)
3. Builds the CMake project with `BUILD_HKP_SAUCER=ON`

### Build configuration

Default configuration is `Release`.

```bash
./build.sh Debug
```

## Frontend dev server

For UI iteration, run the frontend in dev mode from `meander/frontend`:

```bash
cd meander/frontend
npm install
npm start
```

This starts Vite on port `5555` with hot reload. To use the dev server instead of embedded assets, configure CMake with embedding disabled:

```bash
cmake -S . -B build -DMEANDER_USE_EMBEDDED_FRONTEND=OFF
```

## Manual build example

Example `Release` build from repo root:

```bash
cmake -S . -B build -DMEANDER_USE_EMBEDDED_FRONTEND=ON
cmake --build build --target meander --config Release
```

## Output

Build artifacts are generated under `build/`.

On macOS, the Saucer app bundle is produced at:

```text
build/hkp-saucer/hkp-saucer.app
```

## Rebuild from scratch

If you need a clean configure/build:

```bash
rm -rf build
./build.sh
```
