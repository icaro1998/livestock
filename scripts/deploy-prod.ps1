param(
  [string]$ComposeFile = "infra/docker-compose.prod.stack.yml",
  [string]$EnvFile = ".env.production",
  [string]$BaseUrl = "http://localhost:3000",
  [switch]$SkipValidate,
  [switch]$SkipBuild,
  [switch]$SkipMigrate,
  [switch]$SkipHealth,
  [switch]$Smoke
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$CommandArgs
  )
  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($CommandArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

# Resolve repo root from script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

if (-not (Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Create it from .env.production.example."
}

if (-not $SkipValidate) {
  $env:NODE_ENV = "production"
  $env:ALLOW_DOTENV = "true"
  $env:DOTENV_PATH = $EnvFile
  Invoke-Checked -Command "npm" -CommandArgs @("run", "prod:validate")
  Remove-Item Env:NODE_ENV, Env:ALLOW_DOTENV, Env:DOTENV_PATH -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Invoke-Checked -Command "docker" -CommandArgs @("build", "-f", "apps/api/Dockerfile", "-t", "livestock-api:latest", ".")
}

# Start DB/Redis first when present in the compose file
$services = & docker compose -f $ComposeFile config --services 2>$null
if ($services -and ($services -contains "postgres" -or $services -contains "redis")) {
  $deps = @()
  if ($services -contains "postgres") { $deps += "postgres" }
  if ($services -contains "redis") { $deps += "redis" }
  if ($deps.Count -gt 0) {
    $depArgs = @("compose", "-f", $ComposeFile, "up", "-d") + $deps
    Invoke-Checked -Command "docker" -CommandArgs $depArgs
  }
}

if (-not $SkipMigrate) {
  Invoke-Checked -Command "docker" -CommandArgs @(
    "compose", "-f", $ComposeFile, "run", "--rm", "api",
    "npx", "prisma", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"
  )
}

Invoke-Checked -Command "docker" -CommandArgs @("compose", "-f", $ComposeFile, "up", "-d", "api")

if (-not $SkipHealth) {
  & "$repoRoot/scripts/health-check.ps1" -BaseUrl $BaseUrl -MaxAttempts 30 -DelaySeconds 1
  if ($LASTEXITCODE -ne 0) {
    throw "Health check failed."
  }
}

if ($Smoke) {
  if (-not $env:API_ADMIN_EMAIL -or -not $env:API_ADMIN_PASSWORD) {
    Write-Warning "Smoke skipped: set API_ADMIN_EMAIL and API_ADMIN_PASSWORD to run."
  } else {
    $env:API_BASE_URL = $BaseUrl
    Invoke-Checked -Command "npm" -CommandArgs @("run", "smoke", "--workspace", "@livestock/api")
  }
}

Write-Host "Deploy complete."
