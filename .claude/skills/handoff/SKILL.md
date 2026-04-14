---
name: handoff
description: Create handoff document for context transfer between sessions
allowed-tools: Read, Write, Bash, Grep, Glob
---
# Context
- Git status: !`git status`
- Recent commits: !`git log --oneline -20`
- Modified files: !`git diff --name-only HEAD~5 2>/dev/null || echo "fewer than 5 commits"`

# Task
Summarize the current session into a handoff document:
1. What was accomplished this session
2. What's remaining to be done
3. Key decisions made and their rationale
4. Any blockers or open questions
5. List of modified files
6. Current test/build status

Write this to .claude/handoff.md so a new session can pick up where this one left off.
