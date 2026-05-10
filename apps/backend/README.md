# Backend (apps/backend)

## Overview

Python gRPC backend application managed by Nx and `@nxlv/python`.

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm (for Nx)

## Nx targets

All commands below run from the repository root.

### Dependency management

```bash
npx nx run @optitrade/backend:install
npx nx run @optitrade/backend:lock
npx nx run @optitrade/backend:sync
npx nx run @optitrade/backend:add
npx nx run @optitrade/backend:update
npx nx run @optitrade/backend:remove
```

### Development and quality

```bash
npx nx run @optitrade/backend:proto
npx nx run @optitrade/backend:lint
npx nx run @optitrade/backend:format
npx nx run @optitrade/backend:test
npx nx run @optitrade/backend:build
```

## What each target does

- `proto`: Generates Python gRPC code from `protos/helloworld.proto`.
- `lint`: Runs Ruff checks on `src` and `tests`.
- `format`: Runs Ruff format on `src` and `tests`.
- `test`: Runs `uv run pytest tests/` and depends on `proto`.
- `build`: Builds a distributable package into `apps/backend/dist`.

## Portfolio API

The portfolio widget API is available as a small stdlib HTTP service. Routes use
`/api/...` directly, without a `/v1` prefix.

```bash
cd apps/backend
python -m src.portfolio_api --host 127.0.0.1 --port 8000
```

Endpoints:

- `GET /health`: service health check.
- `GET /api/portfolio`: portfolio positions, summary metrics, sector allocation, and intraday history.
- `POST /api/paper-portfolio`: creates a paper portfolio record for later DB persistence.
- `POST /api/portfolio/connect`: validates broker connection settings for the widget's IBKR panel.

## Paths

- Source: `apps/backend/src`
- Tests: `apps/backend/tests`
- Protos: `apps/backend/protos`
- Coverage output: `coverage/apps/backend`
- Test reports: `reports/apps/backend/unittests`
