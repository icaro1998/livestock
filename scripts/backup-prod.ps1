param(
  [string]$ComposeFile = "infra/docker-compose.prod.stack.yml",
  [string]$Service = "postgres",
  [string]$Database = "livestock",
  [string]$User = "livestock",
  [string]$OutDir = "backups"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDirPath = Resolve-Path -Path $OutDir -ErrorAction SilentlyContinue
if (-not $outDirPath) {
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  $outDirPath = Resolve-Path -Path $OutDir
}

$backupPath = Join-Path $outDirPath "livestock-$timestamp.dump"

Write-Host "Writing backup to $backupPath"
& docker compose -f $ComposeFile exec -T $Service pg_dump -U $User -d $Database -Fc > $backupPath

if ($LASTEXITCODE -ne 0) {
  Write-Error "Backup failed"
  exit 1
}

Write-Host "Backup complete"
