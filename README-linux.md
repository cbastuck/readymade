# Building Readymade on Linux

Instructions for building the desktop app on Linux (Ubuntu is the reference distribution).
See [README.md](./README.md) for prerequisites shared by all platforms.

## Prerequisites

- CMake 3.21+
- Node.js + npm

Required packages:

- git
- build-essential
- ninja-build
- pkg-config
- libgtk-4-dev
- libadwaita-1-dev
- libjson-glib-dev
- libwebkitgtk-6.0-dev

Install all required packages:

```bash
sudo apt update
sudo apt install -y git build-essential ninja-build pkg-config libgtk-4-dev libadwaita-1-dev libjson-glib-dev libwebkitgtk-6.0-dev
```

Optional (recommended if your default compiler is too old for saucer):

```bash
sudo apt install -y gcc-14 g++-14
```

Compiler requirement (from saucer):

- GCC/G++ 14+
- Clang/Clang++ 20+

## Build (recommended)

From the repository root:

```bash
./build-linux.sh
```

This builds the web app in `meander/frontend`, configures CMake in `build-linux/`, and builds
the `Readymade` app target.

The build script also enables local vcpkg binary/download caching under `.cache/vcpkg/` by
default, so repeated builds reuse prebuilt dependency artifacts instead of rebuilding large
ports (for example Boost).

If you want to use a shared binary source (for example a CI-provided cache), set
`VCPKG_BINARY_SOURCES` before running the build script.

### Build configuration

Default configuration is `Release`.

```bash
./build-linux.sh Debug
```

To build for dev-server mode (no embedded frontend), use `./build-linux.sh Debug OFF` on a
clean build directory. See [Frontend dev server](./README.md#frontend-dev-server).

### Compiler selection

`build-linux.sh` prefers a modern compiler automatically when `CC`/`CXX` are not set:

- `g++-16`, `g++-15`, `g++-14`, then `clang++-20`

It also sets a matching `CC` (`gcc-<ver>` or `clang-<ver>`) when available.

To force a specific compiler toolchain, set `CC` and `CXX` explicitly:

```bash
CC=gcc-14 CXX=g++-14 ./build-linux.sh
```

Debug example (keeps symbols and produces much larger binaries):

```bash
CC=gcc-14 CXX=g++-14 ./build-linux.sh Debug ON
```

## Runtime troubleshooting

If launching `build-linux/meander/Readymade` fails with errors like:

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
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 ./build-linux/meander/Readymade
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
./build-linux/meander/Readymade
```

Use option 2 only for local development/testing.

## Rebuild from scratch

If you need a clean configure/build:

```bash
rm -rf build-linux
./build-linux.sh
```
