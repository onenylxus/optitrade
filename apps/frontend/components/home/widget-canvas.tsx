'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  DRAWER_WIDGET_MIME,
  GRID_CELL_HEIGHT_REM,
  GRID_CELL_WIDTH_REM,
  GRID_GAP_REM,
  SOURCE_WIDGET_MIME,
  initialPlacements,
  widgetDefaultSpans,
  widgetLibrary,
} from '@/app/(home)/fixtures';
import type { WidgetPlacement, WidgetType } from '@/app/(home)/fixtures';
import { WidgetRenderer } from '@/components/home/widget-renderer';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WidgetCanvasProps {
  isEditMode: boolean;
}

const MIN_EDIT_ROWS = 2;

const cellKey = (col: number, row: number) => `${col}:${row}`;

const createWidgetId = (widgetType: WidgetType) => {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `widget-${widgetType}-${Date.now()}-${randomSuffix}`;
};

const getRemInPixels = () => {
  if (typeof window === 'undefined') {
    return 16;
  }

  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : 16;
};

const buildOccupancy = (placements: WidgetPlacement[]) => {
  const occupancy = new Map<string, string>();

  for (const placement of placements) {
    for (let rowOffset = 0; rowOffset < placement.rowSpan; rowOffset += 1) {
      for (let colOffset = 0; colOffset < placement.colSpan; colOffset += 1) {
        occupancy.set(cellKey(placement.col + colOffset, placement.row + rowOffset), placement.id);
      }
    }
  }

  return occupancy;
};

const clampPlacementToGrid = (placement: WidgetPlacement, gridColumns: number): WidgetPlacement => {
  const colSpan = Math.max(1, Math.min(placement.colSpan, gridColumns));
  const rowSpan = Math.max(1, placement.rowSpan);
  const row = Math.max(0, placement.row);
  const maxColStart = Math.max(0, gridColumns - colSpan);
  const col = Math.max(0, Math.min(placement.col, maxColStart));

  return { ...placement, col, row, colSpan, rowSpan };
};

const canPlaceWidget = (
  candidatePlacement: Pick<WidgetPlacement, 'col' | 'row' | 'colSpan' | 'rowSpan'>,
  sourceWidgetId: string | null,
  occupancy: Map<string, string>,
  gridColumns: number,
) => {
  if (candidatePlacement.col < 0 || candidatePlacement.row < 0) {
    return false;
  }

  if (candidatePlacement.col + candidatePlacement.colSpan > gridColumns) {
    return false;
  }

  for (let rowOffset = 0; rowOffset < candidatePlacement.rowSpan; rowOffset += 1) {
    for (let colOffset = 0; colOffset < candidatePlacement.colSpan; colOffset += 1) {
      const owner = occupancy.get(cellKey(candidatePlacement.col + colOffset, candidatePlacement.row + rowOffset));

      if (owner && owner !== sourceWidgetId) {
        return false;
      }
    }
  }

  return true;
};

const findNextAvailableOrigin = (
  placement: WidgetPlacement,
  occupancy: Map<string, string>,
  gridColumns: number,
) => {
  const maxScanRow = 200;

  for (let row = Math.max(0, placement.row); row < maxScanRow; row += 1) {
    for (let col = 0; col <= gridColumns - placement.colSpan; col += 1) {
      const candidate = { ...placement, col, row };

      if (canPlaceWidget(candidate, placement.id, occupancy, gridColumns)) {
        return candidate;
      }
    }
  }

  return null;
};

const normalizePlacements = (items: WidgetPlacement[], gridColumns: number) => {
  const occupancy = new Map<string, string>();
  const normalized: WidgetPlacement[] = [];

  for (const item of items) {
    const clamped = clampPlacementToGrid(item, gridColumns);
    const nextPlacement = canPlaceWidget(clamped, clamped.id, occupancy, gridColumns)
      ? clamped
      : findNextAvailableOrigin(clamped, occupancy, gridColumns);

    if (!nextPlacement) {
      continue;
    }

    normalized.push(nextPlacement);

    for (let rowOffset = 0; rowOffset < nextPlacement.rowSpan; rowOffset += 1) {
      for (let colOffset = 0; colOffset < nextPlacement.colSpan; colOffset += 1) {
        occupancy.set(cellKey(nextPlacement.col + colOffset, nextPlacement.row + rowOffset), nextPlacement.id);
      }
    }
  }

  return normalized;
};

const getInitialNormalizationColumns = (items: WidgetPlacement[]) => {
  const maxPlacementColumns = items.reduce(
    (max, placement) => Math.max(max, placement.col + Math.max(1, placement.colSpan)),
    1,
  );

  return maxPlacementColumns;
};

export function WidgetCanvas({ isEditMode }: WidgetCanvasProps) {
  const canvasWidthRef = useRef<HTMLDivElement | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const [placements, setPlacements] = useState<WidgetPlacement[]>(() =>
    normalizePlacements(initialPlacements, getInitialNormalizationColumns(initialPlacements)),
  );
  const [draggedWidget, setDraggedWidget] = useState<{
    widgetType: WidgetType;
    sourceWidgetId: string | null;
  } | null>(null);

  useEffect(() => {
    const element = canvasWidthRef.current;

    if (!element) {
      return;
    }

    const updateColumns = () => {
      const remInPixels = getRemInPixels();
      const cellWidthPx = GRID_CELL_WIDTH_REM * remInPixels;
      const gapPx = GRID_GAP_REM * remInPixels;
      const availableWidthPx = element.clientWidth;
      const computedColumns = Math.max(1, Math.floor((availableWidthPx + gapPx) / (cellWidthPx + gapPx)));

      setGridColumns((prev) => (prev === computedColumns ? prev : computedColumns));
    };

    updateColumns();

    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const normalizedPlacements = useMemo(
    () => normalizePlacements(placements, gridColumns),
    [gridColumns, placements],
  );

  const occupiedCells = useMemo(() => {
    return buildOccupancy(normalizedPlacements);
  }, [normalizedPlacements]);

  const visibleRowCount = useMemo(() => {
    const maxOccupiedRow =
      normalizedPlacements.length > 0
        ? Math.max(...normalizedPlacements.map((placement) => placement.row + placement.rowSpan - 1))
        : -1;

    if (!isEditMode) {
      return maxOccupiedRow >= 0 ? maxOccupiedRow + 1 : 0;
    }

    return Math.max(maxOccupiedRow + 2, MIN_EDIT_ROWS);
  }, [isEditMode, normalizedPlacements]);

  const visibleCells = useMemo(
    () =>
      Array.from({ length: visibleRowCount * gridColumns }, (_, index) => {
        const col = index % gridColumns;
        const row = Math.floor(index / gridColumns);
        return { col, row, key: cellKey(col, row) };
      }),
    [gridColumns, visibleRowCount],
  );

  const onDragStartFromCell = (
    event: DragEvent<HTMLDivElement>,
    widgetType: WidgetType,
    sourceWidgetId: string,
  ) => {
    if (!isEditMode) {
      return;
    }

    event.dataTransfer.setData(DRAWER_WIDGET_MIME, widgetType);
    event.dataTransfer.setData('text/plain', widgetType);
    event.dataTransfer.setData(SOURCE_WIDGET_MIME, sourceWidgetId);
    event.dataTransfer.effectAllowed = 'copyMove';

    setDraggedWidget({ widgetType, sourceWidgetId });
  };

  const onDropToCell = (event: DragEvent<HTMLDivElement>, col: number, row: number) => {
    event.preventDefault();

    if (!isEditMode) {
      return;
    }

    const draggedWidgetType =
      draggedWidget?.widgetType ??
      (event.dataTransfer.getData(DRAWER_WIDGET_MIME) as WidgetType) ??
      (event.dataTransfer.getData('text/plain') as WidgetType);
    const sourceWidgetIdFromEvent = event.dataTransfer.getData(SOURCE_WIDGET_MIME);
    const sourceWidgetId =
      draggedWidget?.sourceWidgetId ?? (sourceWidgetIdFromEvent.length > 0 ? sourceWidgetIdFromEvent : null);

    if (!draggedWidgetType || !widgetLibrary.some((widget) => widget.id === draggedWidgetType)) {
      setDraggedWidget(null);
      return;
    }

    setPlacements((prev) => {
      const normalizedPrev = normalizePlacements(prev, gridColumns);
      const existingPlacement = sourceWidgetId
        ? normalizedPrev.find((placement) => placement.id === sourceWidgetId)
        : null;
      const defaultSpan = widgetDefaultSpans[draggedWidgetType];
      const colSpan = Math.max(1, Math.min(existingPlacement?.colSpan ?? defaultSpan.cols, gridColumns));
      const rowSpan = existingPlacement?.rowSpan ?? defaultSpan.rows;

      const occupancy = buildOccupancy(normalizedPrev);

      const nextPlacement = { col, row, colSpan, rowSpan };

      if (!canPlaceWidget(nextPlacement, sourceWidgetId, occupancy, gridColumns)) {
        return prev;
      }

      if (existingPlacement) {
        return normalizePlacements(
          normalizedPrev.map((placement) =>
            placement.id === existingPlacement.id ? { ...placement, col, row, colSpan, rowSpan } : placement,
          ),
          gridColumns,
        );
      }

      const newPlacement: WidgetPlacement = {
        id: createWidgetId(draggedWidgetType),
        widgetType: draggedWidgetType,
        col,
        row,
        colSpan,
        rowSpan,
      };

      return normalizePlacements([...normalizedPrev, newPlacement], gridColumns);
    });

    setDraggedWidget(null);
  };

  const clearWidget = (widgetId: string) => {
    setPlacements((prev) => prev.filter((placement) => placement.id !== widgetId));
  };

  return (
    <section className="min-h-0 p-3 sm:p-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardContent className="min-h-0 flex-1 px-4 pt-4 pb-4">
          {!isEditMode && normalizedPlacements.length === 0 ? (
            <div className="text-muted-foreground mb-3 text-sm">
              No widgets placed yet. Switch to edit mode to add widgets.
            </div>
          ) : null}

          {isEditMode ? (
            <div className="text-muted-foreground ml-5 text-xs">
              Edit mode is active. Widgets snap to fixed cells and can span multiple cells.
            </div>
          ) : null}

          <ScrollArea className="h-full rounded-xl">
            <div
              ref={canvasWidthRef}
              className="w-full p-3"
            >
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `repeat(${gridColumns}, ${GRID_CELL_WIDTH_REM}rem)`,
                  gridAutoRows: `${GRID_CELL_HEIGHT_REM}rem`,
                  gap: `${GRID_GAP_REM}rem`,
                }}
              >
                {isEditMode
                  ? visibleCells.map(({ col, row, key }) => {
                      const occupiedBy = occupiedCells.get(key);

                      if (occupiedBy) {
                        return null;
                      }

                      return (
                        <div
                          key={key}
                          className={cn(
                            'flex min-w-0 items-center justify-center rounded-lg border transition-colors',
                            'border-border/70 bg-muted/10 border-dashed hover:bg-muted/25',
                          )}
                          onDragOver={(dropEvent) => {
                            dropEvent.preventDefault();
                            dropEvent.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(dropEvent) => onDropToCell(dropEvent, col, row)}
                        />
                      );
                    })
                  : null}

                {normalizedPlacements.map((placement) => (
                  <div
                    key={placement.id}
                    className="z-10 min-h-0 min-w-0"
                    style={{
                      gridColumn: `${placement.col + 1} / span ${placement.colSpan}`,
                      gridRow: `${placement.row + 1} / span ${placement.rowSpan}`,
                    }}
                  >
                    <div
                      className="h-full w-full"
                      draggable={isEditMode}
                      onDragStart={(event) =>
                        onDragStartFromCell(event, placement.widgetType, placement.id)
                      }
                      onDragEnd={() => setDraggedWidget(null)}
                    >
                      <div
                        className={cn(
                          'h-full w-full rounded-lg p-2 transition-colors',
                          isEditMode ? 'bg-muted/25 hover:bg-muted/40' : '',
                        )}
                      >
                        <WidgetRenderer
                          widgetType={placement.widgetType}
                          showRemoveButton={isEditMode}
                          onRemove={() => clearWidget(placement.id)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}
