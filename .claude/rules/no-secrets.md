---
name: no-secrets
description: Prevent committing secrets or credentials
globs:
  - "**/.env"
  - "**/.env.*"
  - "**/credentials*"
  - "**/*secret*"
  - "**/*token*"
  - "**/*password*"
  - "**/*.pem"
  - "**/*.key"
  - "**/id_rsa*"
---
NEVER commit files matching these patterns. If you encounter them:
1. Add to .gitignore immediately
2. Warn the user
3. Do not include in any git add or commit commands
4. If already tracked by git, warn that it needs to be removed from git history
