param(
  [string]$SourceDb = "livestock",
  [string]$RestoreDb = "livestock_restore",
  [string]$PgUser = "livestock",
  [string]$PgPassword = "livestock",
  [string]$Container = "infra-postgres-1",
  [switch]$Cleanup
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $repoRoot)

Write-Host "Using container: $Container"
Write-Host "Source DB: $SourceDb"
Write-Host "Restore DB: $RestoreDb"

# Create restore DB if missing
$createCmd = "CREATE DATABASE $RestoreDb"
$checkCmd = "SELECT 1 FROM pg_database WHERE datname = '$RestoreDb'"

$exists = docker exec -i $Container psql -U $PgUser -tAc "$checkCmd"
if (-not $exists) {
  Write-Host "Creating restore DB $RestoreDb"
  docker exec -i $Container psql -U $PgUser -c "$createCmd" | Out-Host
} else {
  Write-Host "Restore DB already exists"
}

$env:DATABASE_URL = "postgresql://$PgUser:$PgPassword@localhost:5432/$SourceDb"
$env:RESTORE_DATABASE_URL = "postgresql://$PgUser:$PgPassword@localhost:5432/$RestoreDb"
$env:POSTGRES_CONTAINER = $Container

npm run db:backup-verify

if ($Cleanup) {
  Write-Host "Dropping restore DB $RestoreDb"
  docker exec -i $Container psql -U $PgUser -c "DROP DATABASE IF EXISTS $RestoreDb" | Out-Host
}
