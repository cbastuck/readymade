# hkp Build Guide

Quick instructions for building the project from the repository root.

To build for dev-server mode (no embedded frontend) with the script, use `./build.sh Debug OFF` on a clean `build/` directory.

## Screenshot

![Meander screenshot](./meander-screenshot.png)

## Prerequisites

- CMake 3.21+
- Node.js + npm

### macOS

- Xcode Command Line Tools

### Linux (Ubuntu)

Required packages:

- git
- build-essential
- ninja-build
- pkg-config
- libgtk-4-dev
- libadwaita-1-dev
- libjson-glib-dev
- libwebkitgtk-6.0-dev

Install all required Linux packages:

```bash
sudo apt update
sudo apt install -y git build-essential ninja-build pkg-config libgtk-4-dev libadwaita-1-dev libjson-glib-dev libwebkitgtk-6.0-dev
```

Optional (recommended if your default compiler is too old for saucer):

```bash
sudo apt install -y gcc-14 g++-14
```

Note: vcpkg is vendored in `3rdparty/vcpkg` and is used by CMake during configure/build.

## License and copyright

- License: GNU AGPL v3.0 (see `LICENSE`)
- Copyright ownership: see `COPYRIGHT`

## Build (recommended)

From the repository root:

```bash
./build.sh
```

This does the following:

1. Builds the web app in `meander/frontend` (`npm run build`)
2. Configures CMake in `build/` (first run only)
3. Builds the CMake project and the `meander` app target

The build script also enables local vcpkg binary/download caching under `.cache/vcpkg/` by default, so repeated builds reuse prebuilt dependency artifacts instead of rebuilding large ports (for example Boost).

If you want to use a shared binary source (for example a CI-provided cache), set `VCPKG_BINARY_SOURCES` before running the build script.

### Build configuration

Default configuration is `Release`.

```bash
./build.sh Debug
```

### Linux compiler selection

On Linux, if the default compiler is too old for dependencies, build with GCC 14:

```bash
CC=gcc-14 CXX=g++-14 ./build-linux.sh
```

Debug example (keeps symbols and produces much larger binaries):

```bash
CC=gcc-14 CXX=g++-14 ./build-linux.sh Debug ON
```

### Linux runtime troubleshooting

If launching `build-linux/meander/meander` fails with errors like:

- `bwrap: setting up uid map: Permission denied`
- `Failed to fully launch dbus-proxy`

then WebKit's sandbox process is being blocked from creating an unprivileged user namespace.

On Ubuntu 24.04+, this is commonly caused by AppArmor restriction being enabled:

```bash
sysctl kernel.apparmor_restrict_unprivileged_userns
```

If it prints `= 1`, you can either:

1. Temporary system workaround (until reboot):

```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```

2. Debug-only app workaround (disables WebKit sandbox):

```bash
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 ./build-linux/meander/meander
```

3. Ubuntu 24.04 system-policy fix (community-tested, no absolute app paths):

```bash
sudo tee /etc/apparmor.d/bwrap >/dev/null <<'EOF'
abi <abi/4.0>,
include <tunables/global>

profile bwrap /usr/bin/bwrap flags=(unconfined) {
	userns,
	# Site-specific additions and overrides. See local/README for details.
	include if exists <local/bwrap>
}
EOF

printf 'kernel.apparmor_restrict_unprivileged_userns=0\nkernel.unprivileged_userns_clone=1\n' | sudo tee /etc/sysctl.d/99-userns.conf

# Apply now (without reboot)
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
sudo sysctl -w kernel.unprivileged_userns_clone=1

sudo systemctl restart apparmor
```

Then launch the app normally:

```bash
./build-linux/meander/meander
```

Use option 2 only for local development/testing.

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

## Build on Windows

From the repository root in **PowerShell**:

If your machine blocks local PowerShell scripts, use the `-ExecutionPolicy Bypass` form shown below in the PowerShell notes.

```powershell
.\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

For a clean build:

```powershell
Remove-Item -Recurse -Force .\build -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

For a **static build** (single executable with no DLL dependencies):

```powershell
Remove-Item -Recurse -Force .\build, .\.cache -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

### Windows build options

- `-Configuration`: `Debug`, `Release`, `RelWithDebInfo`, or `MinSizeRel` (default: `Release`)
- `-EmbeddedFrontend`: `ON` or `OFF` (default: `ON`)
- `-VcpkgTriplet`: `x64-windows-static` (static libraries, no DLL dependencies) or `x64-windows` (dynamic libraries) (default: `x64-windows-static`)

### Example: Debug build with dev server

```powershell
.\build-windows.ps1 -Configuration Debug -EmbeddedFrontend OFF -VcpkgTriplet x64-windows
```

**Note:** if `3rdparty/vcpkg` is missing, the Windows build script will clone the pinned `vcpkg` baseline and bootstrap it automatically. This requires `git` to be available on `PATH`.

### PowerShell execution policy

If you get an execution policy error:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows
```

Or set it for the session:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### PowerShell and npm

The Windows build script invokes `npm.cmd` directly. This avoids a known issue with the PowerShell `npm.ps1` wrapper under `Set-StrictMode -Version Latest`, which can fail with an error like `The property 'Statement' cannot be found on this object`.

If you run npm commands manually in the same PowerShell environment and hit that error, use `npm.cmd` instead of `npm`.

## Run tests

Run each project's test suite from the repository root:

```bash
./run-all-tests.sh
```

Or run suites individually:

### hkp-python

```bash
cd hkp-python
./run_tests.sh
```

Optional examples:

```bash
./run_tests.sh -v
./run_tests.sh -k map
```

### hkp-node

```bash
cd hkp-node
npm install
npm test
```

### hkp-rt

```bash
cd hkp-rt
./run-tests.sh
```

Optional examples:

```bash
./run-tests.sh Debug runtime
./run-tests.sh Debug services
```

### hkp-frontend

```bash
cd hkp-frontend
npm install
npm test
```

## Output

Build artifacts are generated under `build/`.

### macOS

The app bundle is produced under `build/meander/<CONFIG>/`.

For example, a `Debug` build produces:

```text
build/meander/Debug/meander.app
```

### Windows

The executable is produced under `build/<CONFIG>/`.

For example, a `Release` build produces:

```text
build/Release/meander.exe
```

## Rebuild from scratch

If you need a clean configure/build:

```bash
rm -rf build
./build.sh
```
