param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath,

  [Parameter(Mandatory = $true)]
  [string]$CertBase64,

  [Parameter(Mandatory = $true)]
  [string]$CertPassword,

  [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path $TargetPath)) {
  throw "Signing target not found: $TargetPath"
}

$certBase64Path = Join-Path $env:RUNNER_TEMP 'windows-signing-cert.b64'
$certPfxPath = Join-Path $env:RUNNER_TEMP 'windows-signing-cert.pfx'

Set-Content -Path $certBase64Path -Value $CertBase64 -NoNewline
certutil -decode $certBase64Path $certPfxPath | Out-Null

$signtool = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin\x64\signtool.exe'
if (-not (Test-Path $signtool)) {
  $signtool = 'signtool.exe'
}

& $signtool sign `
  /fd SHA256 `
  /td SHA256 `
  /tr $TimestampUrl `
  /f $certPfxPath `
  /p $CertPassword `
  $TargetPath

if ($LASTEXITCODE -ne 0) {
  throw "Authenticode signing failed for $TargetPath"
}

& $signtool verify /pa $TargetPath
if ($LASTEXITCODE -ne 0) {
  throw "Authenticode verification failed for $TargetPath"
}

Remove-Item -Force $certBase64Path, $certPfxPath -ErrorAction SilentlyContinue
