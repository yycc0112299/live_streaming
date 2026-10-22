$ErrorActionPreference = 'Stop'
$course = Split-Path $PSScriptRoot -Parent
$repo = Split-Path $course -Parent
$commit = (& git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify package source commit.' }
$files = @('SECOND_PC.md', 'DUAL_OBS.md', 'third-party/AEC-Client-LICENSE.txt', 'scripts/install-aec.ps1', 'scripts/start-aec.ps1', 'scripts/stop-aec.ps1', 'scripts/aec-bridge.py', 'scripts/aec_guard.py', 'scripts/requirements-aec.txt', 'scripts/configure-obs-aec.mjs', 'scripts/calibrate-aec.py', 'scripts/test-aec.py')
$staging = Join-Path $course ('.runtime/exports/stage-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $staging 'course'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$hashes = [ordered]@{}
foreach ($file in $files) {
  $source = Join-Path $course $file
  $destination = Join-Path $target $file
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
  $hashes[$file] = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLower()
}
$dirty = [bool](& git -C $repo status --porcelain)
$manifest = [ordered]@{ sourceCommit=$commit; workingTreeDirty=$dirty; generatedAt=[DateTime]::UtcNow.ToString('o'); files=$hashes; containsCredentials=$false; secondComputerInstalled=$false }
[IO.File]::WriteAllText((Join-Path $target 'MANIFEST.json'),($manifest | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$archive = Join-Path $course ('.runtime/exports/OBS-AEC-Second-PC-' + $commit.Substring(0,7) + '.zip')
Compress-Archive -LiteralPath $target -DestinationPath $archive -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  $expected = @($files | ForEach-Object { 'course/' + $_ }) + @('course/MANIFEST.json')
  $actual = @($zip.Entries | Where-Object { $_.Name } | ForEach-Object { $_.FullName.Replace('\','/') })
  if (Compare-Object ($expected | Sort-Object) ($actual | Sort-Object)) { throw 'Archive contents differ from the source whitelist.' }
  foreach ($entry in $zip.Entries | Where-Object { $_.Name -and $_.FullName -notmatch 'MANIFEST.json$' }) {
    $hash = [Security.Cryptography.SHA256]::Create(); $stream = $entry.Open()
    try { $actualHash = [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLower() }
    finally { $stream.Dispose(); $hash.Dispose() }
    $relative = $entry.FullName.Replace('\','/').Substring(7)
    if ($actualHash -ne $hashes[$relative]) { throw "Archive file failed SHA-256 verification: $relative" }
  }
} finally { $zip.Dispose() }
Write-Output ('Verified package: ' + $archive)
Write-Output ('SHA-256: ' + (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower())
Write-Output ('Files verified: ' + $files.Count + '; source commit: ' + $commit + '; working tree dirty: ' + $dirty)
