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

## Paths

- Source: `apps/backend/src`
- Tests: `apps/backend/tests`
- Protos: `apps/backend/protos`
- Coverage output: `coverage/apps/backend`
- Test reports: `reports/apps/backend/unittests`
