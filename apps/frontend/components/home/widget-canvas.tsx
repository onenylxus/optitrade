'use client';

import * as React from 'react';
import {
  GRID_COLUMNS,
  GRID_TOTAL_CELLS,
  initialPlacements,
  widgetLibrary,
} from '@/app/(home)/fixtures';
import type { WidgetType } from '@/app/(home)/fixtures';
import { WidgetRenderer } from '@/components/home/widget-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function WidgetCanvas() {
  const [placements, setPlacements] =
    React.useState<Partial<Record<number, WidgetType>>>(initialPlacements);
  const [draggedWidget, setDraggedWidget] = React.useState<{
    widgetType: WidgetType;
    fromCell: number | null;
  } | null>(null);

  const onDragStartFromLibrary = (widgetType: WidgetType) => {
    setDraggedWidget({ widgetType, fromCell: null });
  };

  const onDragStartFromCell = (widgetType: WidgetType, fromCell: number) => {
    setDraggedWidget({ widgetType, fromCell });
  };

  const onDropToCell = (targetCell: number) => {
    if (!draggedWidget) {
      return;
    }

    setPlacements((prev) => {
      const next = { ...prev, [targetCell]: draggedWidget.widgetType };

      if (draggedWidget.fromCell !== null && draggedWidget.fromCell !== targetCell) {
        delete next[draggedWidget.fromCell];
      }

      return next;
    });

    setDraggedWidget(null);
  };

  const clearCell = (cellIndex: number) => {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[cellIndex];
      return next;
    });
  };

  return (
    <section className="min-h-0 p-3 sm:p-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap gap-2">
            {widgetLibrary.map((widget) => (
              <Button
                key={widget.id}
                variant="outline"
                size="sm"
                draggable
                onDragStart={() => onDragStartFromLibrary(widget.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                {widget.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 px-4 pb-4">
          <ScrollArea className="h-full rounded-xl border border-dashed border-border/70">
            <div
              className="grid gap-3 p-3"
              style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(240px, 1fr))` }}
            >
              {Array.from({ length: GRID_TOTAL_CELLS }, (_, i) => i).map((cellIndex) => {
                const widgetType = placements[cellIndex];

                return (
                  <div
                    key={cellIndex}
                    className="bg-muted/25 hover:bg-muted/40 flex h-55 min-w-0 items-stretch justify-stretch rounded-lg border border-border/60 p-2 transition-colors"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDropToCell(cellIndex)}
                  >
                    {widgetType ? (
                      <div className="relative h-full w-full">
                        <button
                          type="button"
                          onClick={() => clearCell(cellIndex)}
                          className="bg-background/80 text-muted-foreground hover:text-foreground absolute top-2 right-2 z-10 rounded px-2 text-xs"
                        >
                          Clear
                        </button>

                        <div
                          className="h-full w-full"
                          draggable
                          onDragStart={() => onDragStartFromCell(widgetType, cellIndex)}
                        >
                          <WidgetRenderer widgetType={widgetType} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground flex w-full items-center justify-center rounded-md border border-dashed border-border/60 text-sm">
                        Drop Widget Here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}
