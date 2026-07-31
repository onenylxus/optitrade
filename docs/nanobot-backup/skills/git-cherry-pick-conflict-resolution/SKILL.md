---
name: git-cherry-pick-conflict-resolution
description: Resolve git cherry-pick conflicts on modify/delete or modify/modify scenarios involving data files. Use when rebasing or cherry-picking commits onto a divergent branch causes conflicts on JSON/data files.
---

# Git Cherry-Pick Conflict Resolution

## When to Use

When `git cherry-pick` or `git rebase` produces a conflict on a data file (typically `.json`) where one side wants to modify it and the other side wants to delete it or has a different version.

## The Problem

Data files like `paper_portfolios.json` or `editable_portfolio.json` are often modified locally but not pushed to remote. When pulling remote changes and cherry-picking local commits, git sees a "modify/delete" conflict because the remote has a different version of the file.

## Resolution Steps

1. **Check what's staged**:
   ```
   git status
   ```

2. **If conflict is "modify/delete"** (file modified locally but deleted or changed in target branch):
   ```
   # Keep the local version (your changes):
   git rm --staged <file>
   git add <file>
   ```
   OR
   ```
   # Discard your changes (use remote's version):
   git rm --staged <file>
   git checkout HEAD -- <file>
   git add <file>
   ```

3. **Continue the cherry-pick/rebase**:
   ```
   git cherry-pick --continue
   # or
   git rebase --continue
   ```

## Key Insight

`git rm --staged <file>` un-stages the file from the conflict index, effectively telling git "I've resolved this — use my version." This avoids needing to manually edit conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).

## Example: editable_portfolio.json conflict

```bash
# After cherry-pick stopped at conflict:
git rm --staged apps/backend/data/editable_portfolio.json
git cherry-pick --continue
```

This resolves the conflict by keeping the local file as-is.
