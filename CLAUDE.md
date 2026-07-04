# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

Nx monorepo at the root, with three projects under `apps/`:

- `@optitrade/backend` — Python 3.11+, FastAPI + Uvicorn, `uv` for deps via `@nxlv/python`. Ruff for lint/format, pytest for tests.
- `@optitrade/frontend` — Next.js 16 (App Router) + React 19, Tailwind v4 + shadcn/ui (Radix) + `lightweight-charts` + Recharts. ESLint + Prettier, Vitest + Storybook for component dev. Path alias `@/*` resolves to `apps/frontend`.
- `@optitrade/e2e` — Playwright e2e (Chromium/Firefox/WebKit). The Playwright config auto-starts the frontend dev server.

There are no Cursor or Copilot rule files. `.vscode/extensions.json` recommends ESLint, Prettier, Jest Runner, Playwright, and Nx Console.

## Common commands

All commands run from the repo root and target a specific project. List projects/targets with `npx nx show projects` and `npx nx show project <name>`.

### Backend (`@optitrade/backend`)

```bash
# install / sync deps (creates apps/backend/.venv from uv.lock)
npx nx run @optitrade/backend:install

# run REST API on :8000  (gRPC is disabled in main.py — see apps/backend/main.py)
npx nx run @optitrade/backend:start

# add / lock / sync / update / remove deps
npx nx run @optitrade/backend:add <pkg>
npx nx run @optitrade/backend:lock
npx nx run @optitrade/backend:sync
npx nx run @optitrade/backend:update
npx nx run @optitrade/backend:remove <pkg>

# tests (pytest with coverage + html reports), lint, format, build
npx nx run @optitrade/backend:test         # runs `uv run pytest tests/` from apps/backend
npx nx run @optitrade/backend:lint         # ruff check src + tests
npx nx run @optitrade/backend:format       # ruff format src + tests
npx nx run @optitrade/backend:build        # writes apps/backend/dist
```

Run a single test file: `cd apps/backend && uv run pytest tests/test_stock_chart.py -v`.

### Frontend (`@optitrade/frontend`)

```bash
npx nx run @optitrade/frontend:dev                 # next dev (default 127.0.0.1)
npx nx run @optitrade/frontend:build               # next build
npx nx run @optitrade/frontend:start               # next start (depends on build)
npx nx run @optitrade/frontend:lint                # eslint
npx nx run @optitrade/frontend:format              # prettier --write .
npx nx run @optitrade/frontend:storybook           # storybook on :6006
npx nx run @optitrade/frontend:build-storybook
```

`apps/frontend/vitest.config.ts` and `apps/frontend/.storybook/` are configured for in-repo component testing/harnessing.

### E2E (`@optitrade/e2e`)

```bash
npx nx run @optitrade/e2e:test           # auto-starts frontend dev server
npx nx run @optitrade/e2e:show-report
```

### CI / repo-wide

```bash
npx nx run-many -t lint test build typecheck   # what CI runs (.github/workflows/ci.yml)
npx nx graph                                   # visualize the dependency graph
```

## Required environment & secrets

Both apps crash or 503 without these — see `docs/agent-setup-linux.md` for the full runbook.

**`apps/backend/.env`** (gitignored):
- `GOOGLE_APPLICATION_CREDENTIALS` — path to Firebase Admin service-account JSON. Required for `/api/v1/auth/*`; backend still boots without it.
- `FMP_API_KEY` — Financial Modeling Prep. **Required** for `/api/stock/*` and `/api/ai/widget/stock-chart*`; those routes return HTTP 503 if missing.
- `OPENROUTER_API_KEY` — required for AI widget analysis endpoints.
- `OPENROUTER_MODEL` — optional override (default in code).
- `OPTITRADE_PROFILE_STOCK_CHART=1` — optional profiling logs.

**`apps/frontend/.env.local`** (gitignored):
- `NEXT_PUBLIC_BACKEND_URL` — **required**, frontend `lib/api/client.ts` throws on load if unset.
- `NEXT_PUBLIC_FIREBASE_*` — required for the `/auth` page and Firebase auth features.
- `GRPC_BACKEND_HOST` — optional, defaults to `localhost:50051` (gRPC is currently disabled in code anyway).

Backend loads `.env` automatically when initializing Firebase Admin.

## High-level architecture

### Frontend — widget canvas over the App Router

The home page (`apps/frontend/app/(home)/page.tsx`) wires three context providers and renders the canvas:

```
PortfolioProvider                    (contexts/portfolio-context.tsx — pulls /api/portfolio on mount)
└─ ChatContextStoreProvider          (contexts/chat-context-store.tsx — pinned widget text snippets)
   └─ LayoutProvider                 (contexts/layout-context.tsx — per-user layouts in Firestore)
      └─ HomeHeader + WidgetCanvas + EditWidgetDrawer + FloatingChat
```

**`WidgetCanvas` (`components/home/widget-canvas.tsx`)** is the grid engine:
- 13 widget types declared as a `WidgetType` union in `app/(home)/fixtures.ts`, each with a default `cols×rows` span in `widgetDefaultSpans` and a `widgetLibrary` entry used by the Edit drawer.
- Grid math is in grid cells (`GRID_CELL_WIDTH_REM=8`, `GRID_CELL_HEIGHT_REM=8`, `GRID_GAP_REM=0.5`); spans are normalized via `normalizePlacements` on every render and resize.
- Drag/drop uses two MIME types: `application/x-optitrade-widget` (new from drawer) and `application/x-optitrade-source-widget` (move existing).
- Layouts (positions/cols/rows) serialize via `lib/widget-layout-serialization.ts` and persist to Firestore per user via `lib/firebase/widget-layout-store.ts`; auto-saves on a 1 s debounce.

**`WidgetRenderer` (`components/home/widget-renderer.tsx`)** switches `WidgetType` → concrete widget component from `components/dashboard/`. The `text` branch is a **silent fallback** — add new types *before* it.

**`BaseWidget` (`components/dashboard/base-widget.tsx`)** is the shared chrome (title, summary, separator, "MoreVertical" menu). Every dashboard widget must:
1. Accept `Omit<ComponentProps<typeof BaseWidget>, 'children'>`.
2. Pass a textual `contextData={{ label, text }}` (plain string — no JSX) so it plays with the chat context store.
3. Wrap its body in `<BaseWidget {...props} contextData={...}>…</BaseWidget>`.

See `docs/widget-guide.md` for the full widget contract, including stable IDs, edit-mode drag caveats, and the minimal new-widget skeleton. `docs/slash-commands.md` documents `/analyze`, `/portfolio`, `/news`, `/compare`, `/help` (defined in `lib/slash-commands.ts`).

**Backend access from the frontend** is *never* direct — Next.js route handlers under `app/api/*` proxy to the FastAPI service. Notable routes:
- `app/api/grpc/*` — gRPC hello streaming proxies (`@grpc/grpc-js` + `@grpc/proto-loader`).
- `app/api/portfolio/*` — portfolio + paper-trading proxies.
- `app/api/paper-trading/history`, `app/api/prediction/daily`, `app/api/earnings`, `app/api/news`.
- `lib/api/client.ts` (used by widgets) reads `NEXT_PUBLIC_BACKEND_URL` and centralizes error mapping to `ApiError` (`code` + `message`).

**Nanobot (chat + four widgets)** — `lib/use-nanobot.ts` is a large WebSocket hook (~24kB) that connects to `ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone`, parses `<think>` tags via `StreamingThinkParser`, and renders `@openuidev/react-ui` + `@openuidev/react-lang`. Nanobot also owns four dashboard widgets (`market-clock`, `paper-trading-history`, `earnings`, `daily-prediction`); design notes for them live at `docs/widgets/nanobot-widgets.md`. Treat these as the project's AI agent surface — when changing chat behavior or these widgets, the source of truth is the live Nanobot service.

### Backend — service layer + thin FastAPI

Three-tier layout under `apps/backend/src/`:

```
api/
├── controllers/   ← thin per-route controllers (validation + service call)
├── routes/        ← APIRouter per concern (stock, price, ai, portfolio)
├── schemas/       ← Pydantic request/response models
└── deps.py        ← FastAPI Depends builders (singletons, FMP/OpenRouter key checks)
services/          ← business logic (stock chart, portfolio, AI analysis, patterns, support/resistance)
portfolio.py, binance_client.py, ibkr_client.py, futu_client.py  ← data + broker clients
rest_server.py    ← create_app(): routers + lifespan + Firebase auth + news pipeline thread
```

Key wiring points:
- `deps.get_stock_chart_service` raises HTTP 503 if `FMP_API_KEY` is missing; `get_stock_chart_analysis_service` and `get_portfolio_analysis_service` do the same for `OPENROUTER_API_KEY`.
- `rest_server._rest_lifespan` spawns a daemon thread that calls `news_fetcher.run_news_pipeline.start_analysis()` after 2 s and holds a shared `httpx.AsyncClient` for OpenRouter calls on `app.state.http_openrouter`.
- `firebase_auth.verify_firebase_id_token` is the dependency for `/api/v1/auth/me` and `/api/v1/auth/session`; `firestore_store.upsert_authenticated_user` keeps the `user_profiles` collection in sync keyed by Firebase `uid`.
- AI routes live under `/api/ai/widget/*` (`portfolio`, `stock-chart`, `stock-chart/patterns`, `stock-chart/support-resistance`); support/resistance is deterministic (pivot clustering, no LLM).
- The hello REST surface (`/api/v1/hello`, `/api/v1/hello/{name}`, `/api/v1/hello/batch`) is wired in `rest_server.py` and is exercised by frontend unit tests at `apps/frontend/lib/api/__e2e__.test.ts` and `client.test.ts`.

The `news_fetcher/` package (`apps/backend/news_fetcher/`) is a self-contained news analysis pipeline (`fetcher.py` → `analyzer.py` → `pipeline.py`). It's a daemon-thread "sidecar" inside `rest_server` and also has standalone entrypoints (`news_fetcher/run_news_pipeline.py`, `apps/backend/scripts/run_news_pipeline.py`). Latest output lands in `news_fetcher.OUTPUT_FILE`, served at `GET /api/news`.

`apps/backend/scripts/ai4trade_signal_poller.py` is a separate top-level poller script (not wired into Nx targets).

`apps/backend/eval/` is the QA harness scaffold (datasets, generators, judges, pytest harness). `apps/backend/eval/README.md` documents the schema (`meta.source` vs `meta.methodology`, variant-index order, public attribution). Generator scripts live at `apps/backend/eval/scripts/`.

### Tests

- Backend: `apps/backend/tests/` — pytest with `pytest-cov`, `pytest-asyncio`, `pytest-html`. Coverage → `coverage/apps/backend/`, reports → `reports/apps/backend/unittests/`.
- Frontend: Vitest config at `apps/frontend/vitest.config.ts` is a multi-project setup that bundles Vitest into Storybook via `@vitest/browser-playwright` + `@storybook/addon-vitest` (chromium). Examples: `lib/api/client.test.ts` and `lib/api/__e2e__.test.ts`.
- E2E: `apps/e2e/tests/` — Playwright with `baseURL: http://localhost:3000` and `webServer` that boots the frontend.

### Docs

- `README.md` — overview + per-project READMEs.
- `docs/agent-setup-linux.md` — full Linux setup + runbook for AI agents (env vars, ports, troubleshooting). Read this first when onboarding.
- `docs/widget-guide.md` — widget contract and how to add a new widget.
- `docs/slash-commands.md` — chat slash commands.
- `docs/qa-evaluation-plan.md` + `apps/backend/eval/README.md` — evaluation methodology.
- `docs/proposal.txt`, `interim-report.txt`, `progress-update-*.pdf`, `qa-evaluation-plan.html`, `index.html` — academic submission artifacts (unchanged from the COMP7705 project).

## Things to watch out for

- **gRPC is disabled** in `apps/backend/main.py` (the news-pipeline thread is also commented out); the hello server, protobuf files, and `@grpc/grpc-js` route handlers under `app/api/grpc/*` remain in the tree but `main.py` only runs the REST server on `:8000`.
- **Hard dependency on `NEXT_PUBLIC_BACKEND_URL`**: the frontend throws synchronously on module load if it's unset — set it in `apps/frontend/.env.local` before `npx nx run @optitrade/frontend:dev`.
- **Cross-origin dev origins**: `apps/frontend/next.config.ts` whitelists `178.128.213.162` by default for HMR; override with `NEXT_PUBLIC_ALLOWED_DEV_ORIGINS` if testing from another host.
- **CORS is `allow_origins=['*']`** on the FastAPI app — fine for dev but treat the backend as untrusted for any sensitive write surface.
- **Widget renderer fallback is silent**: a missing branch in `WidgetRenderer` renders `<TextWidget>`, not an error. Always add new types *above* the trailing return.
- **Stable widget IDs**: `WidgetCanvas` generates `widget-<type>-<ts>-<rand>` — never hard-code IDs (they're used to dedupe in the chat context store).
- **Shared services, not duplicated logic**: backend controllers must stay thin; put new business logic in `services/`.
- **`@nx/enforce-module-boundaries`** in the root ESLint flat config enforces cross-project import boundaries — don't reach into another app's internals from the frontend.
- **Lint/format scopes**: backend Ruff targets `src` and `tests` only; frontend ESLint + Prettier cover the whole `apps/frontend` tree.
- **Commit conventions**: the project is `master`-based with Nx Cloud (`nxCloudId` in `nx.json`). CI runs `npx nx run-many -t lint test build typecheck` on every PR.