param(
  [switch]$DockerApi,
  [switch]$Smoke,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

# Resolve repo root from script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}

# Ensure local DB/Redis for dev (safe for local workflows)
$envLines = Get-Content ".env"
$envLines = $envLines | ForEach-Object {
  if ($_ -match '^DATABASE_URL=') { 'DATABASE_URL=postgresql://livestock:livestock@localhost:5432/livestock' }
  elseif ($_ -match '^REDIS_URL=') { 'REDIS_URL=redis://localhost:6379' }
  else { $_ }
}
$envLines | Set-Content ".env"

npm install

docker compose -f infra/docker-compose.yml up -d postgres redis

npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

if (-not $SkipSeed) {
  npm run seed --workspace @livestock/api
}

if ($DockerApi) {
  docker compose -f infra/docker-compose.yml up -d --build api
} else {
  npm run generate --workspace @livestock/db
  npm run build --workspace @livestock/shared
  npm run build --workspace @livestock/db
  npm run dev --workspace @livestock/api
}

if ($Smoke) {
  npm run smoke --workspace @livestock/api
}
