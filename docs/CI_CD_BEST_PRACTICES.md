# Node.js + TypeScript Monorepo: CI/CD, Dev Workflow, and Configuration Best Practices

This document captures the recommended CI/CD pipeline gates, local developer workflow, and security/consistency practices for the monorepo.
It is intended to be a living reference and a basis for automation.

## CI/CD pipeline and integrity gates

Required checks (run on every PR):
- Linting and formatting (ESLint + Prettier)
- Type checking (tsc --build or tsc --noEmit)
- Unit tests
- Integration tests (with Postgres/Redis)
- Build + smoke tests (health check)
- Migration safety lint (prevent destructive migrations)
- Event schema compatibility checks (backward compatible only)

Policy:
- All checks are required before merge.
- Any failure blocks the PR.

## Developer environment

Docker-based dev setup:
- Use docker compose to start Postgres/Redis consistently.
- Run the Node API either in Docker or on the host, but always against Docker services.

WSL2 / Windows notes:
- Prefer working inside WSL2 filesystem for file watching reliability.
- If working on Windows filesystem, use polling for watchers.
  Example: set CHOKIDAR_USEPOLLING=true for watch tools.

VS Code standardization:
- Provide recommended extensions and settings.
- Include debug launch configs for the API.
- Provide tasks for common flows (migrate, seed, dev server).

Pre-commit and pre-push hooks:
- Husky + lint-staged for fast checks before commit.
- Pre-push can run the full test suite to catch failures early.

## Security and consistency

Secrets:
- Never commit secrets.
- Use .env.example templates.
- Use GitHub Secrets or a cloud secrets manager for CI and production.

Branch protection:
- Require passing CI and at least one approval.
- Require PRs to be up-to-date with main before merge.
- Use CODEOWNERS to enforce domain-specific reviews.

Conventional commits:
- Enforce semantic commit/PR titles (feat:, fix:, chore:, etc.).
- Enables automated changelogs and versioning.

Dependency and security scans:
- Use Dependabot for upgrades.
- Add container and dependency scans for critical vulnerabilities.

## Codex configuration

The repository includes a machine-readable configuration at `scientific.codex.json`.
This file encodes the desired workflows, validation trees, review scopes, and integrity gates.
It should be kept in sync with CI and dev tooling.
