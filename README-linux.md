# Building Readymade on Linux

Instructions for building the native Linux desktop app (Ubuntu is the reference distribution).

## Prerequisites

- CMake 3.21+
- Node.js + npm
- GCC/G++ 14+ or Clang/Clang++ 20+ (required by `saucer`)
- Required system packages (GTK 4, Libadwaita, WebKitGTK 6.0):

```bash
sudo apt update
sudo apt install -y git build-essential ninja-build pkg-config \
  libgtk-4-dev libadwaita-1-dev libjson-glib-dev libwebkitgtk-6.0-dev
```

If your default compiler is older than GCC 14:

```bash
sudo apt install -y gcc-14 g++-14
```

## Build (recommended)

From the repository root:

```bash
./build-linux.sh
```

This builds `meander/frontend`, configures CMake in `build-linux/` (caching vcpkg artifacts in `.cache/vcpkg/`), and builds the `Readymade` executable in `Release` mode.

### Build options & compiler selection

```bash
./build-linux.sh Debug              # Debug build with embedded frontend
./build-linux.sh Debug OFF          # Debug build using the Vite dev server (on a clean build-linux/ dir)
CC=gcc-14 CXX=g++-14 ./build-linux.sh
```

When `CC`/`CXX` are unset, `build-linux.sh` automatically selects the newest available compiler (`g++-16`, `g++-15`, `g++-14`, or `clang++-20`). See [Frontend dev server](./README.md#frontend-dev-server) for running the live UI server on port `8555`.

## Output

```text
build-linux/meander/Readymade
```

## Runtime troubleshooting (Ubuntu 24.04+ WebKit sandbox)

If launching `build-linux/meander/Readymade` fails with `bwrap: setting up uid map: Permission denied` or `Failed to fully launch dbus-proxy`, Ubuntu's AppArmor policy is blocking WebKit's unprivileged user namespace (`sysctl kernel.apparmor_restrict_unprivileged_userns` prints `1`).

Choose one of:

1. **Temporary workaround (until reboot):**
   ```bash
   sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
   ```
2. **Persistent AppArmor profile for `bwrap`:**
   ```bash
   sudo tee /etc/apparmor.d/bwrap >/dev/null <<'EOF'
   abi <abi/4.0>,
   include <tunables/global>

   profile bwrap /usr/bin/bwrap flags=(unconfined) {
     userns,
     include if exists <local/bwrap>
   }
   EOF
   sudo systemctl restart apparmor
   ```
3. **Debug-only workaround (disables WebKit sandbox for a single run):**
   ```bash
   WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 ./build-linux/meander/Readymade
   ```

## Rebuild from scratch

```bash
rm -rf build-linux
./build-linux.sh
```
