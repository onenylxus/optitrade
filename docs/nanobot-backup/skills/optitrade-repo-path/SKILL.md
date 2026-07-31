---
name: optitrade-repo-path
description: Always use explicit /root/optitrade-clone/ prefix for all file operations targeting the OptiTrade repository. Use on every read_file, edit_file, or write_file call targeting OptiTrade files.
---

# OptiTrade Repo Path Resolution

The OptiTrade repository is at `/root/optitrade-clone`, not in nanobot's workspace.

## When to Use

**Every** file operation targeting OptiTrade source files.

## Rule

**Always** prefix paths with `/root/optitrade-clone/`.

### Correct
```
read_file: /root/optitrade-clone/apps/frontend/components/dashboard/market-clock-widget.tsx
edit_file: /root/optitrade-clone/apps/backend/main.py
write_file: /root/optitrade-clone/apps/frontend/app/api/price/route.ts
```

### Wrong
```
read_file: apps/frontend/components/dashboard/market-clock-widget.tsx
edit_file: apps/backend/main.py
write_file: apps/frontend/app/api/price/route.ts
```

## Why

Nanobot's own workspace is at `/root/.nanobot/workspace/` (contains AGENTS.md, SOUL.md, USER.md, MEMORY.md, skills, sessions). The OptiTrade app is in a completely separate directory.

## Quick Reference

| Target | Path |
|---|---|
| OptiTrade root | `/root/optitrade-clone/` |
| Backend | `/root/optitrade-clone/apps/backend/` |
| Frontend | `/root/optitrade-clone/apps/frontend/` |
| Backend data | `/root/optitrade-clone/apps/backend/data/` |
| Widget components | `/root/optitrade-clone/apps/frontend/components/dashboard/` |
| Next.js API routes | `/root/optitrade-clone/apps/frontend/app/api/` |
| Nanobot workspace | `/root/.nanobot/workspace/` |
| Scripts (nanobot) | `/root/.nanobot/workspace/scripts/` |

## Notes

- The nanobot workspace and OptiTrade repo are **never** the same directory
- This applies to `read_file`, `edit_file`, `write_file`, and any tool that touches OptiTrade files
- Backend runs at `http://127.0.0.1:8000`; frontend at `http://127.0.0.1:3000`
