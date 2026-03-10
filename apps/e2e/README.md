# E2E (apps/e2e)

## Overview

Playwright end-to-end tests for the workspace.

## Prerequisites

- Node.js 18+ and npm

## Local setup

```
cd apps/e2e
npm install
```

## Run tests

```
cd apps/e2e
npx playwright test
```

Open the HTML report (after tests run):

```
npx playwright show-report
```

## Using Nx

If e2e is configured as an Nx project you can run tests from the repo root. List projects with `npx nx show projects` and run targets with `npx nx run <project>:<target>`.

## Notes

- Playwright config: `apps/e2e/playwright.config.ts`
- You can run Playwright from the repo root if dependencies were installed workspace-wide.
