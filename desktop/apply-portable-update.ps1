param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][int]$ParentPid
)
$ErrorActionPreference = 'Stop'
$replacement = "$Target.dkts-new"
$backup = "$Target.dkts-previous"
try {
  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw 'Downloaded update file missing' }
  for ($i = 0; $i -lt 80; $i++) {
    $process = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
    if ($null -eq $process) { break }
    Start-Sleep -Milliseconds 650
  }
  if ($null -ne (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) {
    throw 'Old process did not exit'
  }
  Copy-Item -LiteralPath $Source -Destination $replacement -Force
  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
  if (Test-Path -LiteralPath $Target) {
    Move-Item -LiteralPath $Target -Destination $backup -Force
  }
  try {
    Move-Item -LiteralPath $replacement -Destination $Target -Force
  } catch {
    if (Test-Path -LiteralPath $backup) {
      Move-Item -LiteralPath $backup -Destination $Target -Force
    }
    throw
  }
  Start-Process -FilePath $Target
  Remove-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
} catch {
  $log = Join-Path (Split-Path -Parent $Source) 'last-update-error.txt'
  $_.Exception.Message | Set-Content -LiteralPath $log -Encoding UTF8
  exit 1
}
