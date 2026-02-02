param(
  [string]$BaseUrl = "http://localhost:3000"
)

$health = & curl.exe -fsS "$BaseUrl/healthz"
if ($LASTEXITCODE -ne 0) {
  Write-Error "healthz failed"
  exit 1
}

$metrics = & curl.exe -fsS "$BaseUrl/metrics"
if ($LASTEXITCODE -ne 0) {
  Write-Error "metrics failed"
  exit 1
}

Write-Host "health ok"
