---
name: deep-research
description: Research a topic thoroughly in isolated context
allowed-tools: Read, Grep, Glob, Bash, Agent, WebSearch, WebFetch
agent: true
---
Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code in detail
3. Check documentation, tests, and related modules
4. Use web search if external context is needed
5. Summarize findings with specific file references and line numbers
6. Highlight any concerns, risks, or opportunities found
