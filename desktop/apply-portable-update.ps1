param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][int]$ParentPid
)
$ErrorActionPreference = 'Stop'
$replacement = "$Target.dkts-new"
$backup = "$Target.dkts-previous"
$log = Join-Path (Split-Path -Parent $Source) 'last-update-error.txt'
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
    # The portable launcher may retain the file lock briefly after Electron exits.
    $moved = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
      try {
        Move-Item -LiteralPath $Target -Destination $backup -Force
        $moved = $true
        break
      } catch {
        Start-Sleep -Milliseconds 450
      }
    }
    if (-not $moved) { throw 'Original portable launcher is still locked' }
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
  Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
} catch {
  # The old program can still be on disk even when an update attempt failed.
  # Record the error and relaunch it instead of silently leaving the user
  # with an unchanged executable and no indication why.
  try { $_.Exception.Message | Set-Content -LiteralPath $log -Encoding UTF8 } catch {}
  try {
    if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) -and
        (Test-Path -LiteralPath $Target -PathType Leaf)) {
      Start-Process -FilePath $Target
    }
  } catch {}
  exit 1
}
