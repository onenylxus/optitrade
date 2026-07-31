---
name: git-escape-parens
description: Handle bash syntax errors when git adding directories with parentheses in their paths.
---

# Git Escape Parens

Use when: `git add` fails with syntax errors on paths containing parentheses (e.g., `app/(home)/`).

## Pattern

```bash
# Escape parentheses with backslash before git add
git add app/\(home\)/

# Works for multiple paths too
git add app/\(home\)/ app/\(dashboard\)/

# Verify with git status
git status
```

## Why

Bash interprets `()` as command grouping syntax. Backslash-escaping tells bash to treat them as literal characters.

## Example

```bash
# ❌ Fails: bash: syntax error near unexpected token '('
git add app/(home)/

# ✅ Works
git add app/\(home\)/
```

## Notes

- Only needed for `git add` — `git commit`, `git push`, `git status` handle unescaped paths fine
- Tab-completion in modern shells may auto-escape, but manual commands still need it
- Windows Git Bash and WSL both affected