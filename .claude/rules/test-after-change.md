---
name: test-after-change
description: Always run tests after code changes
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.rs"
  - "**/*.go"
  - "**/*.java"
  - "**/*.rb"
  - "**/*.c"
  - "**/*.cpp"
---
After modifying source code files:
1. Check package.json scripts, Makefile, or pyproject.toml for test commands
2. Run the relevant test suite
3. Fix any failures before proceeding
4. If no tests exist for the changed code, suggest writing them
