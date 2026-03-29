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

Clone the repo and install workspace dependencies:

```
# Clone repository
git clone https://github.com/onenylxus/optitrade.git
cd optitrade

# Install Node.js dependencies
npm install

# Install backend libraries
npx nx run @optitrade/backend:install
```

Please see the per-project README for detailed manual steps (venv, pip, pytest).

## Nx basics

### Terminal (CLI)

- List all projects: `npx nx show projects`
- List all commands (called *targets* in Nx) for a project: `npx nx show project <project-name>`
- Run a project target: `npx nx run <project-name>:<target-name>`

### Interactive Graph (Web)

- Visualize the dependency graph: `npx nx graph`
- List all targets for a project: `npx nx show project <project-name> --web`

### IDE Extension

Visual Studio Code and JetBrains have their own [**Nx console extension**](https://nx.dev/docs/guides/nx-console/console-project-details).

## Where to look next

- Backend README: [apps/backend/README.md](apps/backend/README.md)
- Frontend README: [apps/frontend/README.md](apps/frontend/README.md)
- E2E README: [apps/e2e/README.md](apps/e2e/README.md)

## Reports & coverage

Test outputs and coverage are written to `coverage/` and `reports/` (see `apps/backend/pyproject.toml` for pytest settings).

If something fails on your machine, paste the failing command output and create an issue on GitHub.

