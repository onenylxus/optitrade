---
name: dev-stack-startup
description: Start the OptiTrade dev stack (FastAPI backend + Next.js frontend) with git sync and health verification. Use when user asks to start the dev servers, run the app locally, or get the stack up.
---

# Dev Stack Startup

Start the OptiTrade monorepo: FastAPI backend (port 8000) + Next.js frontend (port 3000).

## When to Use

- User asks to start dev, run the app, or get things running
- User asks to pull latest and verify both servers are up
- Any development session requiring both backend and frontend

## Steps

### 1. Git Sync (Always First)

```bash
cd /root/optitrade-clone
git pull --rebase
```

If push was previously rejected, `git pull --rebase` resolves it.

### 2. Start Backend

```bash
cd /root/optitrade-clone
.venv/bin/python main.py
```

Verify: `curl http://127.0.0.1:8000/health` → `{"status":"healthy"}`
Swagger docs: http://127.0.0.1:8000/docs

### 3. Start Frontend

```bash
cd /root/optitrade-clone/apps/optitrade
pnpm dev -H 0.0.0.0
```

Verify: `curl http://127.0.0.1:3000` → HTTP 200

## Output

```
✅ Git synced to latest
✅ Backend running: http://127.0.0.1:8000 (FastAPI)
✅ Frontend running: http://127.0.0.1:3000 (Next.js)
```

## Notes

- Backend must be running before frontend for API routes to work
- Use `tmux` skill if running interactively — split panes for backend/frontend
- User prefers incremental progress visibility before full execution