'use client';

import type { DragEvent } from 'react';
import { LayoutGrid, MoveRight } from 'lucide-react';
import { DRAWER_WIDGET_MIME, widgetLibrary } from '@/app/(home)/fixtures';
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
    onWidgetDragStart?.(widgetType);
  };

  const isInline = mode === 'inline';
  const isExpanded = isInline || open || isDraggingWidget;

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
            : 'pointer-events-auto relative w-16 border-border/70 bg-card/95 backdrop-blur transition-[width,transform,opacity,box-shadow] duration-300 ease-out hover:w-72 group-hover:w-72',
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
              : 'absolute inset-0 z-10 flex w-16 items-center justify-center overflow-hidden border-0 p-0 opacity-100 transition-opacity duration-300 ease-out group-hover:pointer-events-none group-hover:opacity-0',
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
                'group-hover:transform-none',
              )}
            >
              <LayoutGrid className="size-4 shrink-0" />
              <span>Widget Library</span>
            </CardTitle>
          )}
        </CardHeader>

        {!isInline && (
          <div className="pointer-events-auto absolute inset-0 z-0 flex flex-col opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
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
