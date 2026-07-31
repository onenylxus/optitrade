---
name: nextjs-api-route-absolute-path
description: Fix Next.js API route file path resolution — use absolute paths, not relative paths, for file system operations in route.ts files.
---

## When to Use

- Next.js API route silently returns empty data or 500 errors at runtime
- A widget that works locally fails in production
- `fs.readFileSync` or `fs.readFile` in a route.ts returns nothing
- Error like `Cannot read properties of undefined` or data appears as `null`

## Steps

1. **Identify the route file**: `apps/frontend/app/api/<route>/route.ts`
2. **Find all file system operations**: Look for `fs.readFileSync`, `fs.readFile`, `readFile`, `readFileSync`
3. **Check path type**:
   - ❌ `../backend/...` — relative, resolves from route file location, fails at runtime
   - ❌ `../../backend/...` — relative, fragile, depends on nesting depth
   - ✅ `/root/optitrade-clone/apps/backend/data/...` — absolute, always works
4. **Replace with absolute path**: Use the workspace root prefix `/root/optitrade-clone/`
5. **Verify**: Read the file, confirm path exists, test the endpoint

## Output Format

```
route.ts: ../backend/data/file.json
     → /root/optitrade-clone/apps/backend/data/file.json

Confirmed: file exists at new path.
```

## Example

**Problem**: Paper trading history widget showed no data.
```typescript
// route.ts — BROKEN
const data = fs.readFileSync(
  path.join(process.cwd(), '../backend/data/paper_portfolios.json'),
  'utf-8'
);
```

**Fix**:
```typescript
// route.ts — FIXED
const data = fs.readFileSync(
  '/root/optitrade-clone/apps/backend/data/paper_portfolios.json',
  'utf-8'
);
```

**Result**: Widget renders correctly with live data.
