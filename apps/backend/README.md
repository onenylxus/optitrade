# Backend (apps/backend)

## Overview

Python backend package containing example code and unit tests. The source is under `apps/backend/apps/backend` and tests are in `apps/backend/tests`.

## Prerequisites

- Python 3.9+
- Git

## Recommended: run via Nx (preferred)

This workspace defines Nx targets for the backend (see `apps/backend/project.json`). Use Nx to run install/test/lint/format so outputs and caching integrate with the workspace.

```
# install project environment (uses @nxlv/python:install)
npx nx run @optitrade/backend:install

# run tests (uses pytest via an Nx run-commands target)
npx nx run @optitrade/backend:test

# lint
npx nx run @optitrade/backend:lint

# format
npx nx run @optitrade/backend:format
```

## Manual local setup (without Nx)

Windows (PowerShell):

```
cd apps/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install pytest pytest-cov pytest-html ruff autopep8
```

macOS / Linux:

```
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install pytest pytest-cov pytest-html ruff autopep8
```

## Run tests (manual)

```
cd apps/backend
pytest
```

Pytest is configured in `pyproject.toml` to write coverage to `coverage/apps/backend` and HTML/JUnit reports to `reports/apps/backend/unittests/`.

## Lint & format (manual)

```
ruff apps/backend tests
autopep8 --in-place --recursive apps/backend
ruff format apps/backend
```

## Notes

- Example code: `apps/backend/apps/backend/hello.py`
- Tests: `apps/backend/tests`
- Prefer Nx targets for consistent CI and caching: `npx nx run <project>:<target>`
