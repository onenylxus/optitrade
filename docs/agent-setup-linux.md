# OptiTrade — Linux Setup & Run Runbook (for AI agents)

This document describes how to set up the environment and run **both the backend
(FastAPI) and the frontend (Next.js)** on a Linux machine. Follow the steps in
order. Commands are run from the **repository root** unless stated otherwise.

> Repo layout: this is an Nx monorepo.
> - Backend: `apps/backend` (Python, managed by `uv` via `@nxlv/python`)
> - Frontend: `apps/frontend` (Next.js 16 / React 19)

---

## 1. Prerequisites

Install these system-wide before anything else.

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 18+ (20 LTS recommended) | Nx + Next.js frontend |
| npm | bundled with Node | install JS deps, run Nx |
| Python | 3.11+ (required by `pyproject.toml`) | backend runtime |
| `uv` | latest | Python dependency + venv manager used by the backend |

Install `uv` (Linux):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# then restart your shell or: source $HOME/.local/bin/env
uv --version
```

Verify Node and Python:

```bash
node --version    # >= 18
python3 --version # >= 3.11
```

---

## 2. Install dependencies

### 2a. JavaScript (root workspace + frontend)

```bash
# from repo root
npm install
```

### 2b. Python backend (creates apps/backend/.venv and installs locked deps)

```bash
# from repo root — preferred (uses Nx + @nxlv/python)
npx nx run @optitrade/backend:install
```

Equivalent manual fallback if Nx is unavailable:

```bash
cd apps/backend
uv sync          # creates .venv and installs from uv.lock
cd -
```

---

## 3. Required environment variables & secret files

> Secrets are **git-ignored** and are **not** committed to the repo. They must be
> provided on the machine. Never commit real keys.

### 3a. Backend — `apps/backend/.env`

Create `apps/backend/.env` with the following keys:

```dotenv
# Firebase Admin service-account JSON path (relative to repo root or absolute)
GOOGLE_APPLICATION_CREDENTIALS=apps/backend/optitrade-hku-firebase-adminsdk.json

# Financial Modeling Prep API key — REQUIRED for stock chart endpoints
FMP_API_KEY=<your_fmp_api_key>

# OpenRouter API key — REQUIRED for AI analysis (chart/portfolio) + news pipeline
OPENROUTER_API_KEY=<your_openrouter_api_key>

# Optional tuning (safe defaults exist in code)
OPENROUTER_MODEL=qwen/qwen3-235b-a22b-2507
OPTITRADE_PROFILE_STOCK_CHART=1
```

| Variable | Required? | Effect if missing |
| --- | --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Required for auth routes | Firebase auth (`/api/v1/auth/*`) fails; app still starts |
| `FMP_API_KEY` | Required | Stock chart endpoints return HTTP 503 |
| `OPENROUTER_API_KEY` | Required | AI analysis endpoints return HTTP 503 |
| `OPENROUTER_MODEL` | Optional | Defaults to a built-in model id |
| `OPTITRADE_PROFILE_STOCK_CHART` | Optional | Enables profiling logs |

### 3b. Backend — Firebase service-account JSON

Place the Firebase Admin SDK JSON at the path referenced above, e.g.:

```
apps/backend/optitrade-hku-firebase-adminsdk.json
```

### 3c. Frontend — `apps/frontend/.env.local`

Create `apps/frontend/.env.local`:

```dotenv
# REQUIRED — frontend throws on startup if this is missing
# (see apps/frontend/lib/api/auth.ts and lib/api/client.ts)
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000

# Firebase Web client config (required for login UI to work)
NEXT_PUBLIC_FIREBASE_API_KEY=<...>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<...>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<...>
NEXT_PUBLIC_FIREBASE_APP_ID=<...>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<...>   # optional

# Optional — have safe defaults if omitted
# NEXT_PUBLIC_PORTFOLIO_API_BASE_URL=http://127.0.0.1:8000
# GRPC_BACKEND_HOST=localhost:50051
```

| Variable | Required? | Effect if missing |
| --- | --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | **Required** | Frontend **throws an error on load** |
| `NEXT_PUBLIC_FIREBASE_*` | Required for auth UI | Login/auth features won't work |
| `NEXT_PUBLIC_PORTFOLIO_API_BASE_URL` | Optional | Defaults to `http://127.0.0.1:8000` |
| `GRPC_BACKEND_HOST` | Optional | Defaults to `localhost:50051` |

---

## 4. Run the application

Use **two terminals** (backend and frontend run as long-lived processes).

### Terminal 1 — Backend (REST API on port 8000)

```bash
# from repo root — preferred
npx nx run @optitrade/backend:start
```

Manual fallback:

```bash
cd apps/backend
uv run python main.py
```

Expected: `REST API server started on port 8000` and OpenAPI docs at
`http://localhost:8000/docs`.

> Note: `main.py` currently starts the **REST server only** (gRPC is disabled in
> code). A background news-analysis routine may run on startup.

### Terminal 2 — Frontend (Next.js dev server on port 3000)

```bash
# from repo root
npx nx dev @optitrade/frontend
```

Manual fallback:

```bash
cd apps/frontend
npx next dev -H 127.0.0.1
```

Expected: `Ready` and the app served at `http://127.0.0.1:3000`.

---

## 5. Verify everything is up

```bash
# Backend health (expect: {"status":"healthy"})
curl -s http://127.0.0.1:8000/health

# Backend docs (expect: 200)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs

# Frontend home page (expect: 200)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

Service URLs:

- Frontend: http://127.0.0.1:3000
- Backend REST: http://127.0.0.1:8000
- Backend API docs: http://127.0.0.1:8000/docs

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Frontend crashes on load with `NEXT_PUBLIC_BACKEND_URL is not defined` | Missing env var | Add `NEXT_PUBLIC_BACKEND_URL` to `apps/frontend/.env.local`, restart dev server |
| Chart endpoints return 503 `FMP_API_KEY is not configured` | Missing/empty `FMP_API_KEY` | Set it in `apps/backend/.env`, restart backend |
| AI endpoints return 503 `OPENROUTER_API_KEY is not configured` | Missing/empty `OPENROUTER_API_KEY` | Set it in `apps/backend/.env`, restart backend |
| Firebase auth errors | Bad/missing `GOOGLE_APPLICATION_CREDENTIALS` or JSON file | Verify path and that the JSON exists |
| `uv: command not found` | `uv` not installed / not on PATH | Reinstall `uv`, `source $HOME/.local/bin/env` |
| Port already in use (8000/3000) | Old process still running | `lsof -nP -iTCP:8000 -sTCP:LISTEN` then `kill <PID>` |
| Backend import/dependency errors | Deps not synced | Re-run `npx nx run @optitrade/backend:install` (or `uv sync` in `apps/backend`) |

### Stop the servers

```bash
# find and kill by port
kill $(lsof -t -iTCP:8000 -sTCP:LISTEN)   # backend
kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)   # frontend
```

---

## 7. Quick reference (copy/paste)

```bash
# One-time setup
curl -LsSf https://astral.sh/uv/install.sh | sh && source $HOME/.local/bin/env
npm install
npx nx run @optitrade/backend:install
# ...then create apps/backend/.env, the Firebase JSON, and apps/frontend/.env.local (see section 3)

# Run (two terminals)
npx nx run @optitrade/backend:start     # terminal 1 -> :8000
npx nx dev @optitrade/frontend          # terminal 2 -> :3000
```
