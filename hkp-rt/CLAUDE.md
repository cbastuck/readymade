# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build System

The canonical build entry point is the **root `/hkp/` directory**, not `hkp-rt/` directly. CMake 3.21+, C++20 (hkp-rt) / C++23 (hkp-saucer), vcpkg for most dependencies.

```bash
# From the repo root (/hkp/) — use build.sh (handles arch + frontend)
./build.sh [Release|Debug|RelWithDebInfo] [ON|OFF]

# Or invoke cmake directly (must pass CMAKE_OSX_ARCHITECTURES on macOS —
# vcpkg.cmake returns early if it is empty/unset)
cmake -B build -DCMAKE_OSX_ARCHITECTURES="$(uname -m)" ..
cmake --build build --config Release

# Skip the GUI app (hkp-saucer)
cmake -DBUILD_HKP_SAUCER=OFF ...

# Skip FFmpeg/avcpp
cmake -DENABLE_FFMPEG=OFF ...

# macOS Intel cross-compilation (pass from root)
cmake -DCMAKE_OSX_ARCHITECTURES=x86_64 ...

# Windows (with prebuilt Boost, set BOOST_ROOT before cmake)
BOOST_ROOT=/path/to/boost cmake ...
cmake --build . --config Release --target ALL_BUILD

# Linux via Docker
docker build --platform linux/amd64 -f hkp-rt/Dockerfile.linux -t hkp/rt-base .
```

`hkp-rt/` can still be built standalone (its CMakeLists.txt falls back to `../3rdparty/` when not invoked from root).

## Dependency Layout

All dependency management lives in the **root `CMakeLists.txt`** and **root `vcpkg.json`**:

| Dep | How | Location |
|-----|-----|----------|
| Boost, OpenSSL, FFmpeg, fdk-aac | vcpkg | root `vcpkg.json` |
| Inja (template engine) | CPM | fetched at configure time |
| Saucer (GUI framework) | CPM | fetched at configure time (custom fork) |
| minimp4 (MP4 demuxer) | CPM | fetched at configure time |
| Crow HTTP | vendored header | `3rdparty/crow.h` |
| avcpp (FFmpeg C++ wrapper) | local subdir | `3rdparty/avcpp/` |
| vcpkg itself | local subdir | `3rdparty/vcpkg/` |

The root CMakeLists.txt creates a single `hkp-rt-deps` INTERFACE target that aggregates all of the above. Both `hkp-rt-lib` and `hkp-rt-bundle` link against it.

### Adding a new vcpkg package

vcpkg runs in **classic mode** — packages live in `3rdparty/vcpkg/installed/` and are installed explicitly. `3rdparty/vcpkg.json` is the authoritative list of required packages (documentation and reproducibility) but vcpkg does **not** read it automatically during the build.

Classic mode is intentional: vcpkg is activated via `include()` inside `3rdparty/CMakeLists.txt` _after_ CPM runs. CPM packages must be fetched before vcpkg initialises to avoid `packageProject()` ALIAS target conflicts with vcpkg's `add_library` wrapper. Passing `-DCMAKE_TOOLCHAIN_FILE` on the cmake command line would activate vcpkg before CPM, breaking that ordering.

**When a new package is added**, the full workflow is:

```bash
# 1. Add the package name to 3rdparty/vcpkg.json (for documentation)

# 2. Install it into the classic store
./3rdparty/vcpkg/vcpkg install <package-name> --triplet arm64-osx

# 3. Delete the CMake cache so any stale NOTFOUND results are cleared
rm build/CMakeCache.txt

# 4. Rebuild
./build.sh Debug OFF
```

Step 3 is necessary because cmake caches negative `find_package`/`find_library` results. Even after vcpkg installs the package, cmake reuses the cached `NOTFOUND` value until the cache is cleared.

## Architecture

HKP is a modular **audio/data processing runtime** with a REST API and WebSocket interface.

### Core Abstractions

- **App** (`hkp-rt/lib/src/app.cpp`) — top-level manager; owns multiple `Runtime` instances and a `Registry`; runs the `boost::asio` event loop
- **Runtime** (`hkp-rt/lib/src/runtime.cpp`) — a pipeline of `Service` instances; loads config from JSON; manages WebSocket connections
- **Service** (`hkp-rt/lib/src/service.cpp`) — base class for all processing nodes; subclasses live in `hkp-rt/lib/src/services/`
- **Registry** (`hkp-rt/lib/src/registry.cpp`) — factory pattern for services; supports compile-time registration and dynamic loading of bundle plugins (via `dlopen`)

### Data Flow

Services pass `Data` objects (defined in `hkp-rt/lib/include/types/data.h`) through the pipeline. `Data` is a `boost::variant` over: `FloatRingBuffer`, `JSON`, `BinaryData`, `String`, `Null`, `ControlFlowData`, `CustomData`. Audio is streamed as ring buffers; control/config messages as JSON.

### HTTP API (Crow framework, `hkp-rt/lib/src/http/`)

- `GET/POST/DELETE /runtimes` — manage runtime lifecycle
- `GET/POST /runtimes/<id>` — inspect or update a runtime's config
- `POST /runtimes/<id>/rearrange` — reorder services in a pipeline

### Services (`hkp-rt/lib/src/services/`)

~23 built-in services, including:

- Audio I/O: `core-input`, `core-output` (macOS CoreAudio)
- Network: `websocket-reader`, `websocket-writer`, `websocket-client`, `websocket-server`, `http-client`, `http-server`
- Processing: `fft`, `ifft`, `filter`, `buffer`, `cache`, `map`
- Analysis: `transient-detector`, `monitor`, `timer`
- Utilities: `static`, `filesystem`, `wav-reader`
- FFmpeg (optional bundle): `ffmpeg` — compiled as `hkp-rt-bundle` shared library, auto-copied to `~/.hkp/bundles/` on build

### Meander

Native GUI app (`meander/`) that embeds `hkp-rt-lib`. Uses the Saucer framework (webview-based UI). The backend (`meander/backend/`) is C++ and links `hkp-rt-lib` + `saucer::saucer`. Frontend assets can be embedded at compile time with `COMILE_USING_SAUCER_EMBEDDINGS=ON`.

### Configuration

Runtimes are configured via JSON (examples in `hkp-rt/config/`). A config defines a `runtimeId` and an ordered list of `services[]` with per-service settings and routing.

## No Dedicated Test Suite

Testing is done by running the HTTP/WebSocket API against a live runtime, using example configs from `hkp-rt/config/`.
