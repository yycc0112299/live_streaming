param([switch]$WebRTC)
$ErrorActionPreference = 'Stop'
$courseRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $courseRoot
$mediaExe = Join-Path $courseRoot '.runtime/mediamtx/mediamtx.exe'
$mediaConfig = Join-Path $courseRoot '.runtime/mediamtx.yml'
if (!(Test-Path -LiteralPath $mediaExe)) { throw 'Run powershell -File scripts/install-media.ps1 first.' }
$configureArgs = @('scripts/configure.mjs')
if ($WebRTC) { $configureArgs += '--webrtc'; $mediaConfig = Join-Path $courseRoot '.runtime/mediamtx.webrtc.yml' }
& node @configureArgs
if ($LASTEXITCODE -ne 0) { throw 'Configuration failed' }
& $mediaExe --validate-conf=$mediaConfig
if ($LASTEXITCODE -ne 0) { throw 'Invalid MediaMTX configuration' }
$ports = @(1935, 8888, 9997, 4180)
if ($WebRTC) {
  $ports += 8889
  if (Get-NetUDPEndpoint -LocalPort 8189 -ErrorAction SilentlyContinue) { throw 'UDP 8189 is already in use.' }
}
foreach ($port in $ports) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Existing services were left running." }
}
$oldWebRTC = $env:VITE_WEBRTC
try { $env:VITE_WEBRTC = if ($WebRTC) { 'true' } else { 'false' }; & npm.cmd run build; $buildResult = $LASTEXITCODE }
finally { $env:VITE_WEBRTC = $oldWebRTC }
if ($buildResult -ne 0) { throw 'Frontend build failed' }
$mediaProcess = Start-Process -FilePath $mediaExe -ArgumentList ('"' + $mediaConfig + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput '.runtime/media.stdout.log' -RedirectStandardError '.runtime/media.stderr.log'
try { & node --env-file-if-exists=.env server.mjs }
finally { if (!$mediaProcess.HasExited) { Stop-Process -Id $mediaProcess.Id } }
