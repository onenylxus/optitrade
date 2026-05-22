# OptiTrade Widget Developer Guide

## Stack & Layout

- **Framework**: Next.js App Router, React client components, Tailwind + shadcn/ui (`components/ui/*`), Radix primitives, Recharts, lightweight-charts, Storybook + Vitest.
- **Path alias**: `@/*` resolves to the frontend root (`apps/frontend`). Always import via `@/components/...`, `@/contexts/...`, `@/lib/...`, `@/app/...`.

---

## Top-Level Flow

```
app/(home)/page.tsx                  ← page shell, providers, layout
 ├─ HomeHeader                       (edit/chat toggles)
 ├─ WidgetCanvas (components/home/widget-canvas.tsx)
 │   └─ WidgetProvider               (per-widget context: id, edit mode, onDelete)
 │       └─ WidgetRenderer           (switch over WidgetType → concrete widget)
 ├─ EditWidgetDrawer                 (drag source: widget library)
 └─ ChatPanel                        (consumes ChatContextStore)
```

Two app-wide providers wrap the page:

- `PortfolioProvider` (`contexts/portfolio-context.tsx`) — portfolio data shared across widgets.
- `ChatContextStoreProvider` (`contexts/chat-context-store.tsx`) — set of `{widgetId, label, text}` items the user has pinned to chat.

---

## Widget Contract

Every dashboard widget renders through `BaseWidget` (`components/dashboard/base-widget.tsx`), which provides:

- Card chrome (title, summary, separator, scrollable body).
- The `MoreVertical` dropdown with **Add to Context** and (in edit mode) **Delete**.
- Integration with `useWidgetContext()` (edit mode, `widgetId`, `onDelete`) and `useChatContextStore()`.

A widget must:

1. Accept the same shape as `BaseWidget` props minus `children` (`Omit<ComponentProps<typeof BaseWidget>, 'children'>`).
2. Build a `contextData = { label, text }` summarizing its state in plain text — this is what gets sent to chat when "Add to Context" is clicked. See `NumberWidget`, `TableWidget`, `ChartWidget` for patterns.
3. Render its body inside `<BaseWidget {...props} contextData={...}>...</BaseWidget>`.

---

## How to Add a New Widget — Step by Step

**1. Create the component** at `components/dashboard/<your>-widget.tsx`.
   - Mark `'use client'` only if it uses hooks, refs, or effects.
   - Wrap the body in `BaseWidget`; supply `contextData` so the widget plays nicely with the chat context store.
   - For shared state (portfolio, etc.), consume the existing context — do not refetch.

**2. Register the type** in `app/(home)/fixtures.ts`:
   - Add the literal to the `WidgetType` union.
   - Add a default span to `widgetDefaultSpans`. Units are grid cells of `4rem × 3.5rem` with `0.5rem` gap (`GRID_CELL_WIDTH_REM` / `GRID_CELL_HEIGHT_REM` / `GRID_GAP_REM`).
   - Add a `widgetLibrary` entry — this is what shows in the Edit drawer.
   - Optional: add to `initialPlacements` so it appears on first load.

**3. Wire the renderer** in `components/home/widget-renderer.tsx`:
   - Add an `if (widgetType === 'your-type') return <YourWidget ... />` branch.
   - **Caution**: the trailing `return <TextWidget ... />` is a silent fallback. New types must be matched _before_ it.

**4. Add a Storybook story** at `stories/<your>-widget.stories.tsx` mirroring existing siblings — this is the recommended dev harness.

**5. Add tests** via Vitest if needed (`vitest.config.ts` is already configured).

---

## Things to Be Careful About

- **Grid math**: spans are in grid cells, not pixels. Choose default `cols`/`rows` that fit at typical screen widths. Oversized widgets get re-flowed by `normalizePlacements` in `widget-canvas.tsx`.
- **Stable widget IDs**: never hard-code an id — `WidgetCanvas` generates `widget-<type>-<ts>-<rand>` via `createWidgetId`. The id is what `BaseWidget` uses to dedupe in the chat context store.
- **`contextData.text` must be a plain string**. Avoid JSX. If your widget renders rich content, summarize textually (see `TextWidget`'s `'[rich content]'` fallback).
- **`onContextButtonClick` override**: if you pass it, you bypass the default add/remove logic in `BaseWidget` — only do this if you also manage `useChatContextStore` yourself.
- **Edit mode drag behavior**: dragging is wired at the canvas level via two MIME types — `DRAWER_WIDGET_MIME` (new widget from drawer) and `SOURCE_WIDGET_MIME` (moving an existing placement). Don't intercept `onDragStart`/`onDrop` inside your widget body or you'll break repositioning.
- **Client vs server components**: `BaseWidget` is server-render-safe, but any widget using hooks must declare `'use client'` at the top.
- **Props passthrough**: `BaseWidget` spreads unknown props onto the underlying `Card`. Don't leak DOM-invalid props from your widget interface; use `Omit<ComponentProps<typeof BaseWidget>, 'children'>` like the existing widgets.
- **Portfolio data**: read via `usePortfolioContext()` (see `NewsWidget`). Don't add a parallel fetch for the same data.
- **Styling**: stick to Tailwind design tokens (`bg-muted`, `text-foreground`, `border-border`, `text-primary`) so theming stays consistent. Size variants should be props (`variant: 'small' | 'medium' | 'large'`) following the `PortfolioWidget` pattern.
- **Large widgets**: `candlestick-widget.tsx`, `portfolio-widget.tsx`, and `news-widget.tsx` are large single files. Consider splitting into subcomponents inside a folder if your widget grows past ~300 lines.
- **API access**: backend is reached through `app/api/grpc/*` route handlers and helpers in `lib/api/`. Don't call the backend directly from the component.

---

## Minimal New-Widget Skeleton

```tsx
'use client';
import type { ComponentProps } from 'react';
import { BaseWidget } from './base-widget';

interface MyWidgetProps extends Omit<ComponentProps<typeof BaseWidget>, 'children'> {
  value: number;
}

export function MyWidget({ value, ...props }: MyWidgetProps) {
  const contextText = `${props.title}: ${value}`;
  return (
    <BaseWidget {...props} contextData={{ label: props.title, text: contextText }}>
      <div className="text-2xl font-bold">{value}</div>
    </BaseWidget>
  );
}
```

Then: add `'my'` to `WidgetType`, give it a span in `widgetDefaultSpans`, list it in `widgetLibrary`, and branch on it in `WidgetRenderer`.

---

## PR Checklist

- [ ] New `WidgetType` literal + default span + `widgetLibrary` entry in `fixtures.ts`
- [ ] `WidgetRenderer` branch added _before_ the text fallback
- [ ] Widget wrapped in `BaseWidget` with a textual `contextData`
- [ ] `'use client'` only where needed
- [ ] Storybook story added
- [ ] No drag handlers inside the widget body that conflict with the canvas
- [ ] No hard-coded widget IDs or duplicate portfolio fetches
