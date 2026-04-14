---
name: fix-issue
description: Fix a GitHub issue by number
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, TodoWrite
agent: true
---
# Context
- Issue details: !`gh issue view $ARGUMENTS`

# Task
Analyze and fix this issue:
1. Search codebase for relevant files using Grep and Glob
2. Read and understand the relevant code
3. Implement the fix
4. Write and run tests if applicable
5. Ensure linting and type checking pass
6. Create a descriptive commit message referencing the issue
7. Ask the user before pushing or creating a PR
