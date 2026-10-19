$ErrorActionPreference = 'Stop'
$courseRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $courseRoot
$mediaExe = Join-Path $courseRoot '.runtime/mediamtx/mediamtx.exe'
$mediaConfig = Join-Path $courseRoot '.runtime/mediamtx.yml'
if (!(Test-Path -LiteralPath $mediaExe)) { throw 'Run powershell -File scripts/install-media.ps1 first.' }
& node scripts/configure.mjs
if ($LASTEXITCODE -ne 0) { throw 'Configuration failed' }
& $mediaExe --validate-conf=$mediaConfig
if ($LASTEXITCODE -ne 0) { throw 'Invalid MediaMTX configuration' }
foreach ($port in @(1935, 8888, 9997, 4180)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Existing services were left running." }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
$mediaProcess = Start-Process -FilePath $mediaExe -ArgumentList ('"' + $mediaConfig + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput '.runtime/media.stdout.log' -RedirectStandardError '.runtime/media.stderr.log'
try { & node --env-file-if-exists=.env server.mjs }
finally { if (!$mediaProcess.HasExited) { Stop-Process -Id $mediaProcess.Id } }
