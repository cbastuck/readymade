param(
  [ValidateSet('Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel')]
  [string]$Configuration = 'Release',

  [ValidateSet('ON', 'OFF')]
  [string]$EmbeddedFrontend = 'ON',

  [ValidateSet('x64-windows', 'x64-windows-static')]
  [string]$VcpkgTriplet = 'x64-windows-static',

  [string]$Generator = 'Visual Studio 17 2022',
  [string]$Architecture = 'x64'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$npm = 'npm.cmd'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolchain = Join-Path $repoRoot '3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake'
$vcpkgRoot = Join-Path $repoRoot '3rdparty/vcpkg'
$vcpkgManifest = Join-Path $repoRoot '3rdparty/vcpkg.json'

function Get-VcpkgBaseline {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
  )

  if (-not (Test-Path $ManifestPath)) {
    throw "Missing vcpkg manifest: $ManifestPath"
  }

  $manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
  if (-not $manifest.'builtin-baseline') {
    throw "Missing builtin-baseline in vcpkg manifest: $ManifestPath"
  }

  return [string]$manifest.'builtin-baseline'
}

function Initialize-Vcpkg {
  param(
    [Parameter(Mandatory = $true)]
    [string]$VcpkgRoot,

    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
  )

  if (Test-Path $toolchain) {
    return
  }

  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    throw 'Git is required to initialize 3rdparty/vcpkg automatically, but it was not found on PATH.'
  }

  $baseline = Get-VcpkgBaseline -ManifestPath $ManifestPath

  Write-Host '==> Initializing vcpkg'
  if (-not (Test-Path $VcpkgRoot)) {
    & $git.Source clone https://github.com/microsoft/vcpkg.git $VcpkgRoot
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to clone vcpkg into 3rdparty/vcpkg.'
    }
  }

  & $git.Source -C $VcpkgRoot fetch origin $baseline
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to fetch vcpkg baseline $baseline."
  }

  & $git.Source -C $VcpkgRoot checkout --force $baseline
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to checkout vcpkg baseline $baseline."
  }

  $bootstrap = Join-Path $VcpkgRoot 'bootstrap-vcpkg.bat'
  if (-not (Test-Path $bootstrap)) {
    throw "Missing vcpkg bootstrap script: $bootstrap"
  }

  & $bootstrap -disableMetrics
  if ($LASTEXITCODE -ne 0) {
    throw 'Failed to bootstrap vcpkg.'
  }
}

Write-Host "==> Building meander frontend"
Write-Host "    embedded frontend: $EmbeddedFrontend"

if ($EmbeddedFrontend -eq 'ON') {
  & $npm --prefix hkp-frontend ci
  & $npm --prefix meander/frontend ci
  & $npm --prefix meander/frontend run build
} else {
  Write-Host '==> Skipping frontend build because embedded frontend is OFF'
}

Initialize-Vcpkg -VcpkgRoot $vcpkgRoot -ManifestPath $vcpkgManifest

if (-not (Test-Path $toolchain)) {
  throw "Missing vcpkg toolchain file: $toolchain"
}

if (-not (Test-Path $vcpkgManifest)) {
  throw "Missing vcpkg manifest: $vcpkgManifest"
}

Write-Host "==> Configuring CMake"
cmake -B build -S . `
  -G "$Generator" -A $Architecture `
  -DVCPKG_MANIFEST_DIR=3rdparty `
  "-DVCPKG_TARGET_TRIPLET=$VcpkgTriplet" `
  -DBUILD_HKP_SAUCER=ON `
  "-DMEANDER_USE_EMBEDDED_FRONTEND=$EmbeddedFrontend"

if ($LASTEXITCODE -ne 0) {
  throw 'CMake configure failed.'
}

Write-Host "==> Building CMake target (config: $Configuration)"
cmake --build build --config $Configuration --parallel

if ($LASTEXITCODE -ne 0) {
  throw 'CMake build failed.'
}

Write-Host '==> Done: build'
