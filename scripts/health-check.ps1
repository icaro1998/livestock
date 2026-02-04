param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$MaxAttempts = 30,
  [int]$DelaySeconds = 1
)

function Wait-ForEndpoint {
  param(
    [string]$Url,
    [string]$Name
  )

  for ($i = 1; $i -le $MaxAttempts; $i++) {
    & curl.exe -fsS $Url > $null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  Write-Error "$Name failed after $MaxAttempts attempts"
  exit 1
}

Wait-ForEndpoint "$BaseUrl/healthz" "healthz"
Wait-ForEndpoint "$BaseUrl/metrics" "metrics"

Write-Host "health ok"
