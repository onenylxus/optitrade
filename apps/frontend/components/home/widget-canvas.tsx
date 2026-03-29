'use client';

import { useMemo, useState, type DragEvent } from 'react';
import {
  DRAWER_WIDGET_MIME,
  GRID_COLUMNS,
  SOURCE_CELL_MIME,
  initialPlacements,
  widgetLibrary,
} from '@/app/(home)/fixtures';
import type { WidgetType } from '@/app/(home)/fixtures';
import { WidgetRenderer } from '@/components/home/widget-renderer';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WidgetCanvasProps {
  isEditMode: boolean;
}

export function WidgetCanvas({ isEditMode }: WidgetCanvasProps) {
  const [placements, setPlacements] =
    useState<Partial<Record<number, WidgetType>>>(initialPlacements);
  const [draggedWidget, setDraggedWidget] = useState<{
    widgetType: WidgetType;
    fromCell: number | null;
  } | null>(null);

  const visibleCellIndexes = useMemo(() => {
    const occupiedCellIndexes = Object.keys(placements)
      .map((key) => Number(key))
      .filter((index) => Number.isInteger(index))
      .sort((a, b) => a - b);

    if (!isEditMode) {
      return occupiedCellIndexes;
    }

    const maxOccupiedCell = occupiedCellIndexes.length > 0 ? Math.max(...occupiedCellIndexes) : -1;
    const extraRowStart = (Math.floor(maxOccupiedCell / GRID_COLUMNS) + 1) * GRID_COLUMNS;
    const extraRowIndexes = Array.from({ length: GRID_COLUMNS }, (_, i) => extraRowStart + i);

    return Array.from(new Set([...occupiedCellIndexes, ...extraRowIndexes])).sort((a, b) => a - b);
  }, [isEditMode, placements]);

  const onDragStartFromCell = (
    event: DragEvent<HTMLDivElement>,
    widgetType: WidgetType,
    fromCell: number,
  ) => {
    if (!isEditMode) {
      return;
    }

    event.dataTransfer.setData(DRAWER_WIDGET_MIME, widgetType);
    event.dataTransfer.setData('text/plain', widgetType);
    event.dataTransfer.setData(SOURCE_CELL_MIME, String(fromCell));
    event.dataTransfer.effectAllowed = 'copyMove';

    setDraggedWidget({ widgetType, fromCell });
  };

  const onDropToCell = (event: DragEvent<HTMLDivElement>, targetCell: number) => {
    event.preventDefault();

    if (!isEditMode) {
      return;
    }

    const draggedWidgetType =
      draggedWidget?.widgetType ??
      (event.dataTransfer.getData(DRAWER_WIDGET_MIME) as WidgetType) ??
      (event.dataTransfer.getData('text/plain') as WidgetType);
    const sourceCellFromEvent = event.dataTransfer.getData(SOURCE_CELL_MIME);
    const sourceCell =
      draggedWidget?.fromCell ??
      (sourceCellFromEvent.length > 0 ? Number.parseInt(sourceCellFromEvent, 10) : null);

    if (!draggedWidgetType || !widgetLibrary.some((widget) => widget.id === draggedWidgetType)) {
      setDraggedWidget(null);
      return;
    }

    setPlacements((prev) => {
      const next = { ...prev, [targetCell]: draggedWidgetType };

      if (sourceCell !== null && Number.isInteger(sourceCell) && sourceCell !== targetCell) {
        delete next[sourceCell];
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
        <CardContent className="min-h-0 flex-1 px-4 pt-4 pb-4">
          {!isEditMode && visibleCellIndexes.length === 0 ? (
            <div className="text-muted-foreground mb-3 text-sm">
              No widgets placed yet. Switch to edit mode to add widgets.
            </div>
          ) : null}

          {isEditMode ? (
            <div className="text-muted-foreground mb-3 text-xs">
              Edit mode is active. Drag widgets from the left panel into the grid.
            </div>
          ) : null}

          <ScrollArea className="h-full rounded-xl border border-dashed border-border/70">
            <div
              className="grid gap-3 p-3"
              style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(240px, 1fr))` }}
            >
              {visibleCellIndexes.map((cellIndex) => {
                const widgetType = placements[cellIndex];

                return (
                  <div
                    key={cellIndex}
                    className="bg-muted/25 hover:bg-muted/40 flex h-55 min-w-0 items-stretch justify-stretch rounded-lg border border-border/60 p-2 transition-colors"
                    onDragOver={(event) => {
                      if (!isEditMode) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => onDropToCell(event, cellIndex)}
                  >
                    {widgetType ? (
                      <div
                        className="h-full w-full"
                        draggable={isEditMode}
                        onDragStart={(event) => onDragStartFromCell(event, widgetType, cellIndex)}
                        onDragEnd={() => setDraggedWidget(null)}
                      >
                        <WidgetRenderer
                          widgetType={widgetType}
                          showRemoveButton={isEditMode}
                          onRemove={() => clearCell(cellIndex)}
                        />
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
