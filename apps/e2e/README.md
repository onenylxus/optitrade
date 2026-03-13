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

## Nx targets

All commands below run from the repository root.

```bash
npx nx run @optitrade/e2e:test
npx nx run @optitrade/e2e:show-report
```

## Direct Playwright commands

```
cd apps/e2e
npx playwright test
```

Open the HTML report (after tests run):

```
npx playwright show-report
```

## Notes

- Playwright config: `apps/e2e/playwright.config.ts`
- Tests directory: `apps/e2e/tests`
