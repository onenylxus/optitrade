---
name: widget-development-workflow
description: Build a new widget for the OptiTrade Next.js app (BaseWidget contract → WidgetRenderer wiring → fixtures.ts → Storybook). Use when user asks to add a widget, implement a widget component, or build UI for the trading app.
---

# Widget Development Workflow

Standard pattern for building OptiTrade widgets. Follow this exact order.

## When to Use

- User asks to add or build a widget
- User asks to implement a new UI component with fixtures and Storybook
- Frontend work on the OptiTrade app

## Steps

### 1. BaseWidget Contract

Every widget must implement the `BaseWidget` contract:

```typescript
interface BaseWidget {
  id: string;
  name: string;
  render(): React.ReactNode;
}
```

Add `implements BaseWidget` to your class/component signature.

### 2. WidgetRenderer Wiring

Register the widget in the widget-renderer component. The renderer maps widget type → component and passes `contextData`.

### 3. fixtures.ts Registration

Add entry to `/apps/optitrade/src/components/widgets/fixtures.ts`:

```typescript
{
  id: 'earnings-calendar',
  type: 'EarningsCalendarWidget',
  title: 'Earnings Calendar',
  defaultSize: { width: 4, height: 3 },
}
```

### 4. Storybook Story

Create `widget-name.stories.tsx` for development/testing in Storybook.

### 5. Drag Handler — Use stopPropagation

When attaching mouse event handlers (especially mousedown) to widget elements:

```typescript
<div onMouseDown={(e) => e.stopPropagation()}>
```

This prevents the drag handler from intercepting clicks/drags on widget internal elements.

## Output Format

```
✅ BaseWidget contract implemented → widget-name-widget.tsx
✅ WidgetRenderer wired → widget-renderer.tsx (or updated)
✅ Fixtures registered → fixtures.ts (entry added)
✅ Storybook story → widget-name.stories.tsx
```

## Example: Earnings Calendar Widget

Files created for the approved plan:

| Phase | Files | Notes |
|-------|-------|-------|
| 1 | `earnings-widget.tsx`, fixtures.ts, widget-renderer | Hardcoded sample data, 6×6 grid |
| 2 | `app/api/earnings/route.ts` | Backend API with yfinance |
| 3 | Portfolio filter | Show only stocks user holds |
| 4 | IV integration | Combine earnings dates + options chain |

## Notes

- **Git workaround**: Escape parentheses with `\` in `git add` for paths like `app/(home)/` — otherwise bash interprets `()` as subshell syntax:
  ```bash
  git add 'app/\(home\)/'
  ```
- **`contextData`**: Return plain text summary from the widget's `contextData()` method. This enables "Add to Context" chat functionality — Timmy can ask Opti about IV/premium for specific earnings.
- **No structural changes** to architecture — only widget additions permitted per user directive.
- **Priority order**: (1) Earnings Calendar ✅ → (2) IV Options → (3) Analyst Consensus
- **Python backend → API route**: For data-fetching routes, Python script (yfinance) outputs to `backend/data/<name>_data.json`; Next.js `app/api/<name>/route.ts` reads that JSON. See `optitrade-api-route-python` skill for the full pattern.