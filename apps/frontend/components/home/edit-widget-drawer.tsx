'use client';

import type { DragEvent } from 'react';
import { LayoutGrid, MoveRight } from 'lucide-react';
import {
  DRAWER_WIDGET_MIME,
  GRID_CELL_HEIGHT_REM,
  GRID_CELL_WIDTH_REM,
  GRID_GAP_REM,
  widgetDefaultSpans,
  widgetLibrary,
} from '@/app/(home)/fixtures';
import type { WidgetType } from '@/app/(home)/fixtures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EditWidgetDrawerProps {
  open: boolean;
  mode?: 'overlay' | 'inline';
  className?: string;
  isDraggingWidget?: boolean;
  onWidgetDragStart?: (widgetType: WidgetType) => void;
  onWidgetDragEnd?: () => void;
}

const getRemInPixels = () => {
  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  );

  return Number.isFinite(rootFontSize) ? rootFontSize : 16;
};

const createWidgetDragSkeleton = (widgetType: WidgetType) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const span = widgetDefaultSpans[widgetType];
  const remInPixels = getRemInPixels();
  const widthPx =
    (span.cols * GRID_CELL_WIDTH_REM + Math.max(0, span.cols - 1) * GRID_GAP_REM) * remInPixels;
  const heightPx =
    (span.rows * GRID_CELL_HEIGHT_REM + Math.max(0, span.rows - 1) * GRID_GAP_REM) * remInPixels;
  const ghost = document.createElement('div');

  ghost.style.position = 'fixed';
  ghost.style.top = '-10000px';
  ghost.style.left = '-10000px';
  ghost.style.width = `${widthPx}px`;
  ghost.style.height = `${heightPx}px`;
  ghost.style.border = '2px dashed color-mix(in oklab, var(--color-primary) 75%, white 25%)';
  ghost.style.borderRadius = '12px';
  ghost.style.background = 'color-mix(in oklab, var(--color-primary) 22%, transparent)';
  ghost.style.boxShadow =
    '0 10px 26px color-mix(in oklab, var(--color-primary) 35%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--color-primary) 30%, transparent)';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '2147483647';

  return ghost;
};

export function EditWidgetDrawer({
  open,
  mode = 'overlay',
  className,
  isDraggingWidget = false,
  onWidgetDragStart,
  onWidgetDragEnd,
}: EditWidgetDrawerProps) {
  const onDragStart = (event: DragEvent<HTMLDivElement>, widgetType: WidgetType) => {
    event.dataTransfer.setData(DRAWER_WIDGET_MIME, widgetType);
    event.dataTransfer.setData('text/plain', widgetType);
    event.dataTransfer.effectAllowed = 'copyMove';

    const dragSkeleton = createWidgetDragSkeleton(widgetType);
    if (dragSkeleton) {
      // Override the browser's list-item clone with a widget-sized skeleton drag image.
      document.body.appendChild(dragSkeleton);
      event.dataTransfer.setDragImage(dragSkeleton, 0, 0);
      window.setTimeout(() => {
        dragSkeleton.remove();
      }, 0);
    }

    onWidgetDragStart?.(widgetType);
  };

  const isInline = mode === 'inline';
  const isExpanded = isInline || open || isDraggingWidget;
  const isShrunkForDrag = !isInline && isDraggingWidget;

  return (
    <aside
      className={cn(
        isInline
          ? 'h-full min-h-0 p-3 sm:p-4'
          : 'group pointer-events-none fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] p-3 sm:p-4',
        !isInline && (isExpanded ? 'opacity-100' : 'opacity-0'),
        className,
      )}
      aria-hidden={!open}
    >
      <Card
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-xl shadow-sm',
          isInline
            ? 'pointer-events-auto'
            : 'pointer-events-auto relative border-border/70 bg-card/95 backdrop-blur transition-[width,transform,opacity,box-shadow] duration-300 ease-out',
          !isInline && !isShrunkForDrag && 'w-16 hover:w-72 group-hover:w-72',
          !isInline && isShrunkForDrag && 'w-16',
          !isInline &&
            (isExpanded
              ? 'translate-x-0 opacity-100 shadow-xl'
              : 'translate-x-0 opacity-100 shadow-lg'),
        )}
      >
        <CardHeader
          className={cn(
            'border-b px-4 py-3 text-left transition-all duration-300 ease-out',
            isInline
              ? ''
              : 'absolute inset-0 z-10 flex items-center justify-center overflow-hidden border-0 p-0 opacity-100 transition-opacity duration-300 ease-out',
            !isInline &&
              !isShrunkForDrag &&
              'w-16 group-hover:pointer-events-none group-hover:opacity-0',
            !isInline && isShrunkForDrag && 'w-16',
          )}
        >
          {isInline ? (
            <>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <LayoutGrid className="size-4 shrink-0" />
                <span className="whitespace-nowrap">Widget Library</span>
              </CardTitle>
              <CardDescription>Drag a widget onto a grid origin.</CardDescription>
            </>
          ) : (
            <CardTitle
              className={cn(
                'flex items-center gap-2 whitespace-nowrap text-sm font-semibold uppercase tracking-wide transform-[rotate(-90deg)] origin-center transition-transform duration-300 ease-out',
                !isShrunkForDrag && 'group-hover:transform-none',
              )}
            >
              <LayoutGrid className="size-4 shrink-0" />
              <span>Widget Library</span>
            </CardTitle>
          )}
        </CardHeader>

        {!isInline && (
          <div
            className={cn(
              'pointer-events-auto absolute inset-0 z-0 flex flex-col transition-opacity duration-300 ease-out',
              isShrunkForDrag
                ? 'pointer-events-none opacity-0'
                : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <CardHeader className="border-b px-4 py-3 text-left">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <LayoutGrid className="size-4 shrink-0" />
                <span className="whitespace-nowrap">Widget Library</span>
              </CardTitle>
              <CardDescription>Drag a widget onto a grid origin.</CardDescription>
            </CardHeader>

            <CardContent className="pointer-events-auto h-full space-y-2 overflow-y-auto p-3">
              {widgetLibrary.map((widget) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, widget.id)}
                  onDragEnd={() => onWidgetDragEnd?.()}
                  className="border-border/70 bg-muted/20 hover:bg-muted/35 cursor-grab rounded-lg border p-3 transition-colors active:cursor-grabbing"
                >
                  <div className="text-foreground text-sm font-medium">{widget.label}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <MoveRight className="size-3" />
                    Drag to canvas ({widget.sizeLabel})
                  </div>
                </div>
              ))}
            </CardContent>
          </div>
        )}

        {isInline && (
          <CardContent className="h-full space-y-2 overflow-y-auto p-3">
            {widgetLibrary.map((widget) => (
              <div
                key={widget.id}
                draggable
                onDragStart={(event) => onDragStart(event, widget.id)}
                onDragEnd={() => onWidgetDragEnd?.()}
                className="border-border/70 bg-muted/20 hover:bg-muted/35 cursor-grab rounded-lg border p-3 transition-colors active:cursor-grabbing"
              >
                <div className="text-foreground text-sm font-medium">{widget.label}</div>
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <MoveRight className="size-3" />
                  Drag to canvas ({widget.sizeLabel})
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </aside>
  );
}
