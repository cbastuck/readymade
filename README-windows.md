# Building Readymade on Windows

Instructions for building the desktop app on Windows.
See [README.md](./README.md) for prerequisites shared by all platforms.

## Prerequisites

- CMake 3.21+
- Node.js + npm
- `git` on `PATH` (if `3rdparty/vcpkg` is missing, the build script clones the pinned `vcpkg`
  baseline and bootstraps it automatically)

## Build (recommended)

From the repository root in **PowerShell**:

```powershell
.\build-windows.ps1 -Configuration Release -EmbeddedFrontend ON -VcpkgTriplet x64-windows-static
```

If your machine blocks local PowerShell scripts, use the `-ExecutionPolicy Bypass` form shown
under [PowerShell execution policy](#powershell-execution-policy).

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

## Build options

- `-Configuration`: `Debug`, `Release`, `RelWithDebInfo`, or `MinSizeRel` (default: `Release`)
- `-EmbeddedFrontend`: `ON` or `OFF` (default: `ON`)
- `-VcpkgTriplet`: `x64-windows-static` (static libraries, no DLL dependencies) or
  `x64-windows` (dynamic libraries) (default: `x64-windows-static`)

### Example: Debug build with dev server

```powershell
.\build-windows.ps1 -Configuration Debug -EmbeddedFrontend OFF -VcpkgTriplet x64-windows
```

See [Frontend dev server](./README.md#frontend-dev-server) for running Vite alongside it.

## Output

The executable is produced under `build/<CONFIG>/`.

For example, a `Release` build produces:

```text
build/Release/Readymade.exe
```

## Troubleshooting

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

The Windows build script invokes `npm.cmd` directly. This avoids a known issue with the
PowerShell `npm.ps1` wrapper under `Set-StrictMode -Version Latest`, which can fail with an
error like `The property 'Statement' cannot be found on this object`.

If you run npm commands manually in the same PowerShell environment and hit that error, use
`npm.cmd` instead of `npm`.
