param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$projectRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $projectRoot "dist"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputPath) {
  $OutputPath = Join-Path $distDir "CaiZheng-submission-$stamp.zip"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("hireproof-package-" + [guid]::NewGuid().ToString("N"))
$stageRoot = Join-Path $tempRoot "CaiZheng"

$rootExcluded = @(
  ".env",
  ".git",
  ".agents",
  ".aws",
  ".codex",
  ".idea",
  ".vscode",
  "data",
  "dist",
  "node_modules",
  ".DS_Store"
)
$excludedDirectories = @("__pycache__")
$excludedFilePatterns = @("*.pyc", "*.log")
$excludedNamePatterns = @(".tmp-*", ".edge-*", ".ui-*")

function Test-ExcludedEntry {
  param(
    [System.IO.FileSystemInfo]$Entry,
    [bool]$IsRoot
  )

  if ($IsRoot -and $rootExcluded -contains $Entry.Name) { return $true }
  if ($Entry.Name -eq ".env" -or ($Entry.Name -like ".env.*" -and $Entry.Name -ne ".env.example")) {
    return $true
  }
  if ($Entry.PSIsContainer -and $excludedDirectories -contains $Entry.Name) { return $true }
  foreach ($pattern in $excludedFilePatterns) {
    if (-not $Entry.PSIsContainer -and $Entry.Name -like $pattern) { return $true }
  }
  foreach ($pattern in $excludedNamePatterns) {
    if ($Entry.Name -like $pattern) { return $true }
  }
  return $false
}

function Copy-SubmissionTree {
  param(
    [string]$Source,
    [string]$Destination,
    [bool]$IsRoot = $false
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach ($entry in Get-ChildItem -LiteralPath $Source -Force) {
    if (Test-ExcludedEntry -Entry $entry -IsRoot $IsRoot) { continue }
    $target = Join-Path $Destination $entry.Name
    if ($entry.PSIsContainer) {
      Copy-SubmissionTree -Source $entry.FullName -Destination $target
    } else {
      Copy-Item -LiteralPath $entry.FullName -Destination $target
    }
  }
}

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  Copy-SubmissionTree -Source $projectRoot -Destination $stageRoot -IsRoot $true

  $forbiddenFiles = @(Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Force | Where-Object {
    $_.Name -eq ".env" -or ($_.Name -like ".env.*" -and $_.Name -ne ".env.example")
  })
  $forbiddenData = @(Get-ChildItem -LiteralPath $stageRoot -Recurse -Directory -Force | Where-Object {
    $_.FullName -eq (Join-Path $stageRoot "data")
  })
  if ($forbiddenFiles.Count -or $forbiddenData.Count) {
    throw "提交包安全检查失败：仍包含 .env 或 data 目录"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
  Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $OutputPath -CompressionLevel Optimal
  $sizeMb = [Math]::Round((Get-Item -LiteralPath $OutputPath).Length / 1MB, 2)
  Write-Output "Submission package created: $OutputPath ($sizeMb MB)"
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
