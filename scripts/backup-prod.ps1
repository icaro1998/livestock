param(
  [string]$ComposeFile = "infra/docker-compose.prod.stack.yml",
  [string]$Service = "postgres",
  [string]$Database = "livestock",
  [string]$User = "livestock",
  [string]$OutDir = "backups",
  [int]$Retain = 7,
  [int]$CompressLevel = 9,
  [string]$PgPassword = "",
  [string]$LogDir = "logs"
)

$ErrorActionPreference = "Stop"

# Resolve repo root from script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDirPath = Join-Path $repoRoot $LogDir
if (-not (Test-Path $logDirPath)) {
  New-Item -ItemType Directory -Force $logDirPath | Out-Null
}
$logPath = Join-Path $logDirPath "backup-$timestamp.log"
$transcribing = $false
try {
  Start-Transcript -Path $logPath -Force | Out-Null
  $transcribing = $true
} catch {
  Write-Warning "Unable to start transcript: $($_.Exception.Message)"
}

try {
$outDirPath = Resolve-Path -Path $OutDir -ErrorAction SilentlyContinue
if (-not $outDirPath) {
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  $outDirPath = Resolve-Path -Path $OutDir
}

$backupPath = Join-Path $outDirPath "livestock-$timestamp.dump"
$hashPath = "$backupPath.sha256"

Write-Host "Writing backup to $backupPath"
$execArgs = @("compose", "-f", $ComposeFile, "exec", "-T")
if ($PgPassword) {
  $execArgs += @("-e", "PGPASSWORD=$PgPassword")
}
$execArgs += @($Service, "pg_dump", "-U", $User, "-d", $Database, "-Fc", "-Z", "$CompressLevel", "--no-owner", "--no-acl")
& docker @execArgs > $backupPath

if ($LASTEXITCODE -ne 0) {
  Write-Error "Backup failed"
  exit 1
}
if (-not (Test-Path $backupPath) -or (Get-Item $backupPath).Length -le 0) {
  Write-Error "Backup file missing or empty"
  exit 1
}

$hash = Get-FileHash -Algorithm SHA256 -Path $backupPath
"$($hash.Hash)  $([IO.Path]::GetFileName($backupPath))" | Set-Content -Path $hashPath
Write-Host "SHA256: $($hash.Hash)"

if ($Retain -gt 0) {
  $old = Get-ChildItem -Path $outDirPath -Filter "livestock-*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Retain
  foreach ($item in $old) {
    $sha = "$($item.FullName).sha256"
    Remove-Item -Force $item.FullName -ErrorAction SilentlyContinue
    Remove-Item -Force $sha -ErrorAction SilentlyContinue
  }
}

Write-Host "Backup complete"
} finally {
  if ($transcribing) {
    try {
      Stop-Transcript | Out-Null
    } catch {}
  }
  Write-Host "Log saved to $logPath"
}
