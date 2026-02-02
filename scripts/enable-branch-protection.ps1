param(
  [string]$Branch = "main",
  [string]$Owner = "icaro1998",
  [string]$Repo = "livestock"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) not found. Install it and run 'gh auth login' first."
  exit 1
}

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "GitHub CLI not authenticated. Run 'gh auth login' first."
  exit 1
}

$body = @{
  required_status_checks = @{
    strict = $true
    contexts = @(
      "ci / lint",
      "ci / type-check",
      "ci / fastify-boot-smoke",
      "ci / unit-tests",
      "ci / integration-smoke"
    )
  }
  enforce_admins = $true
  required_pull_request_reviews = @{
    required_approving_review_count = 1
    require_code_owner_reviews = $true
    dismiss_stale_reviews = $true
  }
  restrictions = $null
  required_linear_history = $true
  allow_force_pushes = $false
  allow_deletions = $false
}

$bodyJson = $body | ConvertTo-Json -Depth 10
$bodyJson | gh api -X PUT "repos/$Owner/$Repo/branches/$Branch/protection" --input -
