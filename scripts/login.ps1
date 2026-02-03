param(
  [string]$BaseUrl = $env:API_BASE_URL,
  [string]$Email = $env:API_ADMIN_EMAIL,
  [string]$Password = $env:API_ADMIN_PASSWORD,
  [switch]$Raw
)

if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }
if (-not $Email) { throw "Email missing. Set -Email or API_ADMIN_EMAIL." }
if (-not $Password) { throw "Password missing. Set -Password or API_ADMIN_PASSWORD." }

$body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress

try {
  $resp = Invoke-RestMethod "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body $body
  if ($Raw) {
    $resp | ConvertTo-Json -Depth 10
  } else {
    Write-Host "accessToken:"
    Write-Host $resp.accessToken
    Write-Host "refreshToken:"
    Write-Host $resp.refreshToken
    Write-Host "expires_at:"
    Write-Host $resp.expires_at
  }
} catch {
  if ($_.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $payload = $reader.ReadToEnd()
      if ($payload) { Write-Error $payload }
    } catch {}
  }
  throw
}
