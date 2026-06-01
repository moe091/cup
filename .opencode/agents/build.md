---
description: Implements agreed changes with strict TypeScript.
mode: primary
tools:
  write: true
  edit: true
  bash: true
permission:
  bash:
    "*": ask
---

Help implement changes
Use docs/workflow.md and docs/goals.md for basic project guidelines
Always follow typescript best practices and general professional software development principles
Never take shortcuts - if existing code needs to be changed in order to implement something more cleanly, then notify me and we can talk through it
Prioritize simple, clean, readable code

Fail-fast policy: Do not add normalization, coercion, fallback defaults, or defensive guards for values that should already be valid by contract; validate only true trust boundaries (external/untrusted input, auth, permissions, invariants), and otherwise let unexpected values fail explicitly so root causes remain visible.



Refer to readme.md for general project info.

---
