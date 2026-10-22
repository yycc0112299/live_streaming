$ErrorActionPreference = 'Stop'
$course = Split-Path $PSScriptRoot -Parent
$root = Join-Path $course '.runtime/aec'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$name = 'AEC-Web-v1.13.1-win64'
$archive = Join-Path $root ($name + '.zip')
if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri "https://github.com/samudinzul/aec-client/releases/download/v1.13.1/$name.zip" -OutFile $archive }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne '2b17531a7ec5e619f4213b686be0c8fb6d3c54537e666878164d73914875282d') { throw 'AEC archive SHA-256 mismatch.' }
$folder = Join-Path $root 'web'
if (!(Test-Path -LiteralPath (Join-Path $folder $name))) { Expand-Archive -LiteralPath $archive -DestinationPath $folder }
$python = if ($env:AEC_PYTHON) { $env:AEC_PYTHON } else { 'python' }
$venv = Join-Path $root 'venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $venv)) { & $python -m venv (Join-Path $root 'venv'); if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ is required; set AEC_PYTHON to its executable.' } }
& $venv -m pip install -r (Join-Path $PSScriptRoot 'requirements-aec.txt')
if ($LASTEXITCODE -ne 0) { throw 'AEC Python dependencies failed to install.' }
Write-Output 'Verified AEC Client v1.13.1 / f76ed632649723003e8778661d565523bdbd5732 (MIT).'
Write-Output 'Driver-free OBS bridge installed. No system audio settings or microphone capture were started.'
