---
name: optitrade-git-cleanup
description: Remove unwanted commits entirely from Git history using git reset --hard + force push. Use when asked to clean up git history, squash commits, remove accidental data commits, or undo local changes before pushing.
---

# OptiTrade Git Cleanup

Remove unwanted commits entirely from Git history (preferred over reverting).

## When to Use

- Undo accidental commits (e.g., price data files, node_modules, build artifacts)
- Clean up before pushing to GitHub
- Remove a range of bad commits from local history

## The Method

Use `git reset --hard` to the target commit, then force push. This **completely removes** unwanted commits from history — not just adding a revert on top.

## Steps

### 1. Identify the Target Commit

Find the commit hash you want to keep — **use the remote origin/master commit, not the local branch tip**:

```bash
cd /root/optitrade-clone
git log --oneline origin/master..HEAD   # show commits ahead of remote
git log --oneline -5 origin/master      # show commits on origin/master
```

Target = the origin/master commit hash (the last known-good commit on the remote). E.g. `b0b1a2e` or `c1dba7a`.

### 2. Hard Reset

```bash
git reset --hard <target-sha>
```

⚠️ **Critical**: Always target `origin/master` or an earlier remote commit, NOT the local HEAD. Resetting to the local branch tip defeats the purpose — you need to go back to where the remote already is.

This moves HEAD to the target commit and discards everything after it.

### 3. Force Push

```bash
git push --force-with-lease origin master
```

`--force-with-lease` is safer than `--force` — it fails if someone else pushed in the meantime.

**This completely removes commits from history** (unlike revert which adds new commits). Use this method only when you want a clean, squashed history before pushing.

## Gitignore Check

After cleanup, make sure unwanted files are gitignored:

```bash
# Check what's tracked that shouldn't be
git status

# If data files are still tracked:
git rm --cached apps/backend/data/prices.json

# Add to .gitignore
echo "apps/backend/data/*.json" >> apps/backend/.gitignore
```

## Special Cases

### Escape Parentheses in Paths

If you need to add directories with parentheses in the name:

```bash
git add 'app/\(home)/'
```

### Partial Cleanup (Keep Some Commits)

To remove only the last N commits:

```bash
git reset --hard HEAD~3   # remove last 3 commits
```

## Output Format

```
✅ Hard reset to <commit_hash>
✅ Force pushed to origin/master
✅ History cleaned — N commits removed
```

## Notes

- **Always** verify the target commit is correct before resetting
- **Coordinate** with collaborators if the branch is shared
- **After force push**, other collaborators need to re-clone or `git reset --hard origin/master`
