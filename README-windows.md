# Building Readymade on Windows

Instructions for building the native Windows desktop app (`Readymade.exe`).

## Prerequisites

- CMake 3.21+
- Node.js + npm
- Visual Studio 2022 (Desktop development with C++)
- `git` on `PATH` (if `3rdparty/vcpkg` is missing, `build-windows.ps1` clones the pinned baseline and bootstraps it automatically)

## Build (recommended)

From the repository root in **PowerShell**:

```powershell
.\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

### Build options

- `-Configuration`: `Release` (default), `Debug`, `RelWithDebInfo`, or `MinSizeRel`
- `-EmbeddedFrontend`: `ON` (default) or `OFF` (uses the [Frontend dev server](./README.md#frontend-dev-server) on port `8555`)
- `-VcpkgTriplet`: `x64-windows-static` (default, single executable with no DLL dependencies) or `x64-windows` (dynamic libraries, faster for debug iteration)

Example Debug build with the live dev server:

```powershell
.\build-windows.ps1 -Configuration Debug -EmbeddedFrontend OFF -VcpkgTriplet x64-windows
```

## Output

```text
build/<CONFIG>/Readymade.exe
```

## Rebuild from scratch

```powershell
Remove-Item -Recurse -Force .\build -ErrorAction SilentlyContinue
.\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

## Troubleshooting

### PowerShell execution policy

If Windows blocks local scripts, allow them for the current session or invoke PowerShell with `-ExecutionPolicy Bypass`:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### PowerShell and `npm`

`build-windows.ps1` invokes `npm.cmd` directly to avoid a known `Set-StrictMode` issue in PowerShell's `npm.ps1` wrapper. If you run npm commands manually in the same PowerShell session and hit a `Statement` property error, run `npm.cmd` instead of `npm`.
