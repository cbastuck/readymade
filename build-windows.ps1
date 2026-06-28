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
$buildDir = Join-Path $repoRoot 'build'
$toolchain = Join-Path $repoRoot '3rdparty/vcpkg/scripts/buildsystems/vcpkg.cmake'
$vcpkgRoot = Join-Path $repoRoot '3rdparty/vcpkg'
$vcpkgManifest = Join-Path $repoRoot '3rdparty/vcpkg.json'

function Reset-BuildDirectoryIfTripletChanged {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BuildDir,

    [Parameter(Mandatory = $true)]
    [string]$RequestedTriplet
  )

  $cachePath = Join-Path $BuildDir 'CMakeCache.txt'
  if (-not (Test-Path $cachePath)) {
    return
  }

  $cacheTripletLine = Select-String -Path $cachePath -Pattern '^VCPKG_TARGET_TRIPLET:STRING=' | Select-Object -First 1
  if (-not $cacheTripletLine) {
    return
  }

  $cachedTriplet = ($cacheTripletLine.Line -split '=', 2)[1]
  if ($cachedTriplet -eq $RequestedTriplet) {
    return
  }

  Write-Host "==> Cached triplet '$cachedTriplet' does not match requested '$RequestedTriplet'"
  Write-Host "==> Removing stale build directory: $BuildDir"
  Remove-Item -Recurse -Force $BuildDir
}

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
Write-Host " using triplet: $ $VcpkgTriplet"

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

Reset-BuildDirectoryIfTripletChanged -BuildDir $buildDir -RequestedTriplet $VcpkgTriplet

Write-Host "==> Configuring CMake"
cmake -B $buildDir -S . `
  -G "$Generator" -A $Architecture `
  -DVCPKG_MANIFEST_DIR=3rdparty `
  "-DVCPKG_TARGET_TRIPLET=$VcpkgTriplet" `
  -DBUILD_HKP_SAUCER=ON `
  "-DMEANDER_USE_EMBEDDED_FRONTEND=$EmbeddedFrontend"

if ($LASTEXITCODE -ne 0) {
  throw 'CMake configure failed.'
}

Write-Host "==> Building CMake target (config: $Configuration)"
cmake --build $buildDir --config $Configuration --parallel

if ($LASTEXITCODE -ne 0) {
  throw 'CMake build failed.'
}

Write-Host '==> Done: build'
