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
}

export function EditWidgetDrawer({ open, mode = 'overlay', className }: EditWidgetDrawerProps) {
  const onDragStart = (event: DragEvent<HTMLDivElement>, widgetType: WidgetType) => {
    event.dataTransfer.setData(DRAWER_WIDGET_MIME, widgetType);
    event.dataTransfer.setData('text/plain', widgetType);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const isInline = mode === 'inline';

  return (
    <aside
      className={cn(
        isInline
          ? 'h-full min-h-0 p-3 sm:p-4'
          : 'pointer-events-none absolute top-16 right-auto bottom-0 left-0 z-50 w-72 p-3 sm:p-4 transition-all duration-300 ease-out',
        !isInline && (open ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'),
        className,
      )}
      aria-hidden={!open}
    >
      <Card
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-xl shadow-sm',
          isInline
            ? 'pointer-events-auto'
            : 'pointer-events-auto transition-transform duration-300 ease-out',
          !isInline && (open ? 'translate-x-0' : '-translate-x-2'),
        )}
      >
        <CardHeader className="border-b px-4 py-3 text-left">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            <LayoutGrid className="size-4" />
            Widget Library
          </CardTitle>
          <CardDescription>Drag a widget onto a grid origin.</CardDescription>
        </CardHeader>

        <CardContent className="h-full space-y-2 overflow-y-auto p-3">
          {widgetLibrary.map((widget) => (
            <div
              key={widget.id}
              draggable
              onDragStart={(event) => onDragStart(event, widget.id)}
              className="bg-muted/20 hover:bg-muted/35 border-border/70 cursor-grab rounded-lg border p-3 transition-colors active:cursor-grabbing"
            >
              <div className="text-foreground text-sm font-medium">{widget.label}</div>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <MoveRight className="size-3" />
                Drag to canvas ({widget.sizeLabel})
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
