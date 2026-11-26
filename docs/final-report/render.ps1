# Opens the deck in PowerPoint (read-only, no window) and exports every slide as PNG for visual QA.
param([string]$Deck = "$PSScriptRoot\Group 9.pptx", [string]$Out = "$env:TEMP\g9-render")
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Out | Out-Null
Get-ChildItem $Out -Filter *.png | Remove-Item -Force
$app = New-Object -ComObject PowerPoint.Application
try {
  $p = $app.Presentations.Open($Deck, -1, 0, 0)   # ReadOnly, Untitled=false, WithWindow=false
  "slides: " + $p.Slides.Count
  foreach ($s in $p.Slides) { $s.Export((Join-Path $Out ("slide-{0:D2}.png" -f $s.SlideIndex)), 'PNG', 1600, 900) }
  $p.Close()
} finally { $app.Quit() }
Get-ChildItem $Out -Filter *.png | ForEach-Object { $_.FullName }
