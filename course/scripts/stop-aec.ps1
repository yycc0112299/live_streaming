$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$private = Join-Path $root '.runtime/AEC-BROWSER-PRIVATE.json'
if (!(Test-Path -LiteralPath $private)) { Write-Output 'No AEC process recorded.'; exit 0 }
$settings = Get-Content -LiteralPath $private -Raw | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$settings.pid)"
if (!$process) { Write-Output 'AEC is already stopped.'; exit 0 }
$expectedPython = [IO.Path]::GetFullPath((Join-Path $root '.runtime/aec/venv/Scripts/python.exe'))
$basePython = (& $expectedPython -c 'import sys; print(sys._base_executable)').Trim()
$expectedScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'aec-bridge.py'))
if ($process.ExecutablePath -notin @($expectedPython, $basePython) -or !$process.CommandLine.Contains($expectedScript)) { throw 'Recorded PID belongs to another process; it was left running.' }
Stop-Process -Id $settings.pid
Write-Output 'AEC stopped; its OBS Browser Source outputs silence.'
