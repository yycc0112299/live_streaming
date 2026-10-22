param([int]$Mic = -1, [int]$Reference = -1, [switch]$List)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$python = Join-Path $root '.runtime/aec/venv/Scripts/python.exe'
$bridge = Join-Path $PSScriptRoot 'aec-bridge.py'
if (!(Test-Path -LiteralPath $python)) { throw 'Run powershell -File scripts/install-aec.ps1 first.' }
if ($List -or $Mic -lt 0 -or $Reference -lt 0) {
  & $python $bridge --list
  Write-Output 'Run start-aec.ps1 -Mic <capture index> -Reference <actual speaker loopback index>. No microphone was opened.'
  exit $LASTEXITCODE
}
if (Get-NetTCPConnection -LocalPort 47660 -State Listen -ErrorAction SilentlyContinue) { throw 'AEC port 47660 is already in use. Existing processes were left running.' }
$process = Start-Process -FilePath $python -ArgumentList @(('"' + $bridge + '"'), '--mic', $Mic, '--reference', $Reference) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root '.runtime/aec.stdout.log') -RedirectStandardError (Join-Path $root '.runtime/aec.stderr.log')
for ($attempt = 0; $attempt -lt 50; $attempt++) {
  if ($process.HasExited) { throw 'AEC failed to start; inspect .runtime/aec.stderr.log.' }
  $private = Join-Path $root '.runtime/AEC-BROWSER-PRIVATE.json'
  $settings = if (Test-Path -LiteralPath $private) { Get-Content -LiteralPath $private -Raw | ConvertFrom-Json } else { $null }
  $owner = if ($settings) { Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$settings.pid)" } else { $null }
  if ($owner -and ($owner.ParentProcessId -eq $process.Id -or $owner.ProcessId -eq $process.Id) -and (Get-NetTCPConnection -LocalPort 47660 -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $settings.pid })) {
    Write-Output 'AEC ready. Run node scripts/configure-obs-aec.mjs while OBS is idle. Stop with scripts/stop-aec.ps1.'
    exit 0
  }
  Start-Sleep -Milliseconds 100
}
Stop-Process -Id $process.Id
throw 'AEC startup timed out; its process was stopped.'
