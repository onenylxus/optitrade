# Frontend (apps/frontend)

## Overview

Next.js frontend application managed by Nx.

## Prerequisites

- Node.js 18+ and npm

## Nx targets

All commands below run from the repository root.

### Local development

```bash
npx nx run @optitrade/frontend:dev
```

### Production build and run

```bash
npx nx run @optitrade/frontend:build
npx nx run @optitrade/frontend:start
```

### Code quality

```bash
npx nx run @optitrade/frontend:lint
npx nx run @optitrade/frontend:format
```

### Storybook

```bash
npx nx run @optitrade/frontend:storybook
npx nx run @optitrade/frontend:build-storybook
```

## What each target does

- `dev`: Runs `next dev` in `apps/frontend`.
- `build`: Runs `next build` in `apps/frontend`.
- `start`: Runs `next start` in `apps/frontend` and depends on `build`.
- `lint`: Runs `eslint` in `apps/frontend`.
- `format`: Runs `prettier --write .` in `apps/frontend`.
- `storybook`: Runs Storybook dev server on port `6006`.
- `build-storybook`: Builds a static Storybook bundle.

## Paths

- App Router source: `apps/frontend/app`
- Shared components: `apps/frontend/components`
- Utilities: `apps/frontend/lib`
- Stories: `apps/frontend/stories`

## Firebase Setup (Frontend)

Firebase Web SDK wiring is available under:

- `apps/frontend/lib/firebase/config.ts`
- `apps/frontend/lib/firebase/client.ts`

You can provide config in either way:

1. Environment variables (recommended):
	- Copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local`
	- Fill `NEXT_PUBLIC_FIREBASE_*` values from Firebase console
2. Direct object override:
	- Edit `directConfigOverride` in `apps/frontend/lib/firebase/config.ts`
	- Paste your Firebase config object values there

The API dashboard includes Firebase actions:

- `Load Firebase Token` (reads token from signed-in Firebase user)
- `REST AUTH /me` (calls backend protected endpoint with bearer token)
