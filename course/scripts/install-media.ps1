$ErrorActionPreference = 'Stop'
$courseRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $courseRoot '.runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$version = '1.21.2'
$archiveName = "mediamtx_v${version}_windows_amd64.zip"
$archivePath = Join-Path $runtimePath $archiveName
$checksumPath = Join-Path $runtimePath 'checksums.sha256'
& curl.exe -fLsS --retry 2 --max-time 300 "https://github.com/bluenviron/mediamtx/releases/download/v$version/$archiveName" -o $archivePath
if ($LASTEXITCODE -ne 0) { throw 'MediaMTX download failed' }
& curl.exe -fLsS --retry 2 --max-time 30 "https://github.com/bluenviron/mediamtx/releases/download/v$version/checksums.sha256" -o $checksumPath
if ($LASTEXITCODE -ne 0) { throw 'Checksum download failed' }
$expected = ((Get-Content $checksumPath | Select-String -SimpleMatch $archiveName).ToString() -split '\s+')[0]
$actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw 'MediaMTX checksum mismatch' }
Expand-Archive -LiteralPath $archivePath -DestinationPath (Join-Path $runtimePath 'mediamtx') -Force
& node (Join-Path $PSScriptRoot 'configure.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Private configuration failed' }
Write-Output 'MediaMTX installed and verified. OBS settings are in .runtime/OBS-PRIVATE.txt.'
