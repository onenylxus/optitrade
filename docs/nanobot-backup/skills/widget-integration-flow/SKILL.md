---
name: widget-integration-flow
description: Integrate a new widget into the OptiTrade Next.js app end-to-end (API route + frontend wiring).
---

# Widget Integration Flow

Use when: adding a new widget to OptiTrade (already have the component or need one built).

## Prerequisites

- Component file exists in `optitrade-widget/src/` (e.g., `earnings-widget.tsx`)
- Implements `BaseWidget` contract with `getData()`, `getColumns()`, `contextData()`, etc.
- `backend/data/<name>_data.json` has sample or live data

## Steps

### 1. Update Type Union

In `optitrade-widget/src/lib/widget-types.ts` (or wherever `WidgetType` is defined):

```typescript
// Add new variant
export type WidgetType = 'portfolio' | 'earnings' | 'iv-options' | ... | '<name>'
```

### 2. Register in fixtures.ts

In `optitrade-widget/src/lib/fixtures.ts`:

```typescript
// Add to widgetDefaultSpans
'<name>': { defaultSpan: 2, minSpan: 1, maxSpan: 3 },

// Add to widgetLibrary
'<name>': {
  type: '<name>',
  title: 'Widget Title',
  icon: 'icon-name',
  component: EarningsWidget,  // imported component
  description: 'What this widget does',
},
```

### 3. Wire in widget-renderer.tsx

In `optitrade-widget/src/components/widget-renderer.tsx` (or wherever `WidgetRenderer` is defined):

```typescript
// Add case in the render switch
case '<name>':
  return <<name>Widget />;
```

### 4. Create API Route (Python + Next.js)

**Python backend** (output to `backend/data/<name>_data.json`):
- Run via `scripts/stock_data.py` or dedicated fetcher
- Writes JSON: `[{ "key": "value", ... }, ...]`

**Next.js API route** (reads that JSON):
- Path: `app/api/<name>/route.ts`
- Reads from `backend/data/<name>_data.json`
- Returns `NextResponse.json(data)`

### 5. Add Storybook Story

In `optitrade-widget/src/stories/<name>.stories.tsx`:
- Import component and render with sample/loading/error states
- Ensure Storybook builds pass (run `npm run storybook`)

### 6. Commit

```bash
git add app/\(home\)/components/    # note: escape parens!
git add src/lib/
git add src/stories/
git commit -m "feat(widget): add <name> widget"
git push origin widget-canvas     # or current working branch
```

### 7. Verify CI

```bash
gh run list --branch widget-canvas
```

## Output

- Widget appears in OptiTrade's widget library
- Filter works (if portfolio-aware)
- `contextData` returns plain text summary for AI context menu
- All CI checks green

## Notes

- Do NOT add structural changes (new folders, refactors) — only widget additions per user directive
- The `contextData()` method is key for AI integration — Timmy can ask Opti about the widget's data directly from chat
- Prioritize urgency signals (e.g., earnings ≤5 days out → orange highlight)