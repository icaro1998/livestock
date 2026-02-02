#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
OWNER="${2:-icaro1998}"
REPO="${3:-livestock}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install it and run 'gh auth login' first." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

cat <<'JSON' | gh api -X PUT "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" --input -
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci / lint",
      "ci / type-check",
      "ci / fastify-boot-smoke",
      "ci / unit-tests",
      "ci / integration-smoke"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
