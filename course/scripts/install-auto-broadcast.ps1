$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'start-auto-broadcast.ps1'
if (!(Test-Path (Join-Path (Split-Path -Parent $PSScriptRoot) '.runtime\OBS-AUTO-DEVICE-PRIVATE.json'))) { throw '請先執行網站顯示的 save-obs-device.mjs 命令。' }
$startup = [Environment]::GetFolderPath('Startup')
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'Group9 Auto Broadcast.lnk'))
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$target`""
$shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
$shortcut.Save()
Write-Host '已設定登入 Windows 後自動啟動 OBS、加入第二路並開始推流。'
