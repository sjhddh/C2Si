---
name: git-diff-explain
description: Explain the current git diff clearly
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---
# Context
- Current git status: !`git status`
- Current git diff: !`git diff HEAD`

# Task
Explain these changes clearly:
1. Summarize what changed at a high level
2. Walk through each file's changes
3. Flag any potential issues or concerns
4. Note if any tests should be added or updated
