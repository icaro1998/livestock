param(
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

npx prisma migrate reset --force --skip-seed --schema packages/db/prisma/schema.prisma

if (-not $SkipSeed) {
  npm run seed --workspace @livestock/api
}
