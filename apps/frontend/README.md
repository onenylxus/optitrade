# Frontend (apps/frontend)

## Overview

Next.js frontend for OptiTrade.

## Prerequisites

- Node.js 18+ and npm

## Local setup

```
cd apps/frontend
npm install
```

## Run development server

```
cd apps/frontend
npx next dev
# or: npm run dev
```

## Build for production

```
cd apps/frontend
npx next build
npx next start
```

## Using Nx

If the frontend is configured as an Nx project, run its targets from the repo root:

```
npx nx show projects
npx nx run <project>:<target>
```

For example, if a target named `build` exists for the frontend project you can run:

```
npx nx run <frontend-project-name>:build
```

## Notes

- You can install dependencies workspace-wide by running `npm install` at the repository root; afterward the frontend commands above will work without re-installing locally.

If something doesn't start, paste the failing command output into an issue for help.
