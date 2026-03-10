# OptiTrade

OptiTrade Copilot: An AI-Driven Trading Portal with Interactive Dynamic Canvas

## Overview

AI-assisted trading platform monorepo managed with Nx. The workspace contains multiple applications under `apps/`:

- `@optitrade/backend` — Python backend (tests, packaging)
- `@optitrade/frontend` — Next.js frontend
- `@optitrade/e2e` — Playwright end-to-end tests

## Prerequisites

- Git
- Node.js 18+ and npm (for Nx, frontend, e2e)
- Python 3.9+ (for the backend)

## Quickstart (recommended)

1. Clone the repo and install workspace dependencies:

```
git clone <repo-url>
cd optitrade
npm install
```

2. Use Nx to run project-specific targets where available (recommended):

- Install backend (uses the Python installer target):

```
npx nx run @optitrade/backend:install
```

- Run backend tests via Nx:

```
npx nx run @optitrade/backend:test
```

If your environment doesn't use the Nx Python targets, see the per-project README for manual steps (venv, pip, pytest).

## Frontend quick run

```
cd apps/frontend
npm install
npx next dev
```

Note: If the frontend is configured as an Nx project, you can run its targets with:

```
npx nx show projects
npx nx run <project>:<target>
```

## E2E tests (Playwright)

```
cd apps/e2e
npm install
npx playwright test
```

You can also open the HTML report after a run with `npx playwright show-report`.

## Nx basics

- List projects: `npx nx show projects`
- Run a project target: `npx nx run <project>:<target>`
- Visualize the dependency graph: `npx nx graph`

## Where to look next

- Backend README: [apps/backend/README.md](apps/backend/README.md)
- Frontend README: [apps/frontend/README.md](apps/frontend/README.md)
- E2E README: [apps/e2e/README.md](apps/e2e/README.md)

## Reports & coverage

Test outputs and coverage are written to `coverage/` and `reports/` (see `apps/backend/pyproject.toml` for pytest settings).

If something fails on your machine, paste the failing command output into an issue.
