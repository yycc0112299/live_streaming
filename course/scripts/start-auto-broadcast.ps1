$ErrorActionPreference = 'Stop'
$course = Split-Path -Parent $PSScriptRoot
$settings = Get-Content (Join-Path $course '.runtime\OBS-AUTO-DEVICE-PRIVATE.json') -Raw | ConvertFrom-Json
$obs = Join-Path $env:ProgramFiles 'obs-studio\bin\64bit\obs64.exe'
if (!(Test-Path $obs)) { throw '找不到 OBS Studio，請先安裝官方 64 位元版本。' }
if (!(Get-Process obs64 -ErrorAction SilentlyContinue)) { Start-Process -FilePath $obs -WorkingDirectory (Split-Path $obs); Start-Sleep -Seconds 8 }
Set-Location $course
& node scripts/obs-controller.mjs $settings.site $settings.token --device --start
