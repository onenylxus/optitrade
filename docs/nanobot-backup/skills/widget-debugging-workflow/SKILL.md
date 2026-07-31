---
name: widget-debugging-workflow
description: Debug Next.js API route and widget issues in the OptiTrade app. Use when widgets show blank, wrong data, or console errors.
---

# Widget Debugging Workflow

## When to Use
- Widget renders blank or shows wrong data
- Console errors like `trades.filter is not a function` or `Module not found`
- API route returns unexpected format
- Data not updating after code changes
- Paper trading or prediction widgets broken

## Steps

### 1. Verify dev server is fresh
Check if old build is running:
```
ps aux | grep 'next dev'
```
If multiple PIDs exist or old Jun date found → kill and restart:
```bash
pkill -f 'next dev'
cd /root/optitrade-clone/apps/frontend && pnpm dev -H 0.0.0.0
```
Wait for "Ready" compilation before testing.

### 2. Test API route directly
```bash
curl -s http://127.0.0.1:3000/api/<route-name> | head -c 500
```
Common routes:
- `/api/paper-trading/history`
- `/api/prediction/daily`

Check response format — is it an array? Object? Error?

### 3. Inspect data file directly
Read the source JSON file:
```
read_file /root/optitrade-clone/apps/backend/data/<file>.json
```
Compare structure to what API route returns.

### 4. Check API route code
```
read_file /root/optitrade-clone/apps/frontend/app/api/<route>/route.ts
```
Look for:
- **Path resolution**: Relative paths (`../backend/...`) fail at runtime — use absolute `/root/optitrade-clone/apps/backend/data/...`
- **Array guards**: `.catch()` handlers that return raw objects instead of arrays → causes `.filter is not a function`
- **Error handling**: Missing null checks on response data

### 5. Check widget component
```
read_file /root/optitrade-clone/apps/frontend/components/dashboard/<widget>.tsx
```
Look for:
- `Array.isArray()` guards before `.filter()/.map()`
- Loading/error state handling
- Props destructuring matches API response shape

### 6. Apply fix
- Edit route.ts or widget component with exact fix
- If API route modified → restart dev server (Ctrl+C + `pnpm dev`)
- If data file modified → just wait for Next.js hot reload

### 7. Verify fix
Re-run curl test → confirm array/object format correct → check browser console.

## Common Fixes Reference

| Error | Cause | Fix |
|---|---|---|
| `.filter is not a function` | `.catch()` returned object instead of array | Add `Array.isArray(data)` guard; return `[]` on error |
| Relative path 404 | `../backend/...` fails at runtime | Use absolute `/root/optitrade-clone/apps/backend/data/...` |
| Blank widget | API returns `{}` or `null` | Add default `?? []` fallback in component |
| Stale data | Old build cached | Kill + restart dev server |
| Hydration mismatch | SSR/CSR data mismatch | Use `useEffect` for client-side only data |

## Output Format
Report: what was broken → what was fixed → verification result.
