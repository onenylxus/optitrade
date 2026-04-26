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
import { WidgetProvider } from '@/contexts/widget-context';
import { WidgetRenderer } from '@/components/home/widget-renderer';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WidgetCanvasProps {
  isEditMode: boolean;
  externalDraggedWidgetType?: WidgetType | null;
}

interface DragPreviewPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
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

  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize,
  );
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
      const owner = occupancy.get(
        cellKey(candidatePlacement.col + colOffset, candidatePlacement.row + rowOffset),
      );

      if (owner && owner !== sourceWidgetId) {
        return false;
      }
    }
  }

  return true;
};

const findClosestValidOrigin = (
  requestedPlacement: Pick<WidgetPlacement, 'col' | 'row' | 'colSpan' | 'rowSpan'>,
  sourceWidgetId: string | null,
  occupancy: Map<string, string>,
  gridColumns: number,
  maxScanRow: number,
) => {
  const maxColStart = Math.max(0, gridColumns - requestedPlacement.colSpan);
  let bestPlacement: Pick<WidgetPlacement, 'col' | 'row' | 'colSpan' | 'rowSpan'> | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row <= maxScanRow; row += 1) {
    for (let col = 0; col <= maxColStart; col += 1) {
      const candidate = {
        col,
        row,
        colSpan: requestedPlacement.colSpan,
        rowSpan: requestedPlacement.rowSpan,
      };

      if (!canPlaceWidget(candidate, sourceWidgetId, occupancy, gridColumns)) {
        continue;
      }

      const colDiff = col - requestedPlacement.col;
      const rowDiff = row - requestedPlacement.row;
      const distance = colDiff * colDiff + rowDiff * rowDiff;

      if (
        distance < bestDistance ||
        (distance === bestDistance && bestPlacement && row < bestPlacement.row) ||
        (distance === bestDistance &&
          bestPlacement &&
          row === bestPlacement.row &&
          col < bestPlacement.col)
      ) {
        bestDistance = distance;
        bestPlacement = candidate;
      }
    }
  }

  return bestPlacement;
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
        occupancy.set(
          cellKey(nextPlacement.col + colOffset, nextPlacement.row + rowOffset),
          nextPlacement.id,
        );
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

export function WidgetCanvas({ isEditMode, externalDraggedWidgetType = null }: WidgetCanvasProps) {
  const canvasWidthRef = useRef<HTMLDivElement | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const [placements, setPlacements] = useState<WidgetPlacement[]>(() =>
    normalizePlacements(initialPlacements, getInitialNormalizationColumns(initialPlacements)),
  );
  const [draggedWidget, setDraggedWidget] = useState<{
    widgetType: WidgetType;
    sourceWidgetId: string | null;
    pickupOffsetPx: { x: number; y: number };
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewPlacement | null>(null);

  const getClosestGridOriginFromPointer = (
    event: DragEvent<HTMLElement>,
    pickupOffsetPx: { x: number; y: number } | null,
  ) => {
    const gridElement = event.currentTarget;

    if (!gridElement) {
      return { col: 0, row: 0 };
    }

    const bounds = gridElement.getBoundingClientRect();
    const remInPixels = getRemInPixels();
    const cellWidthPx = GRID_CELL_WIDTH_REM * remInPixels;
    const cellHeightPx = GRID_CELL_HEIGHT_REM * remInPixels;
    const gapPx = GRID_GAP_REM * remInPixels;
    const colPitch = cellWidthPx + gapPx;
    const rowPitch = cellHeightPx + gapPx;

    const relativeX = event.clientX - bounds.left;
    const relativeY = event.clientY - bounds.top;
    const adjustedX = relativeX - (pickupOffsetPx?.x ?? 0);
    const adjustedY = relativeY - (pickupOffsetPx?.y ?? 0);

    const roughCol = Number.isFinite(adjustedX) ? Math.round(adjustedX / colPitch) : 0;
    const roughRow = Number.isFinite(adjustedY) ? Math.round(adjustedY / rowPitch) : 0;

    return {
      col: Math.max(0, Math.min(roughCol, gridColumns - 1)),
      row: Math.max(0, roughRow),
    };
  };

  useEffect(() => {
    const element = canvasWidthRef.current;

    if (!element) {
      return;
    }

    const updateColumns = () => {
      const remInPixels = getRemInPixels();
      const cellWidthPx = GRID_CELL_WIDTH_REM * remInPixels;
      const gapPx = GRID_GAP_REM * remInPixels;
      const computedStyle = window.getComputedStyle(element);
      const horizontalPaddingPx =
        Number.parseFloat(computedStyle.paddingLeft) +
        Number.parseFloat(computedStyle.paddingRight);
      const availableWidthPx = Math.max(0, element.clientWidth - horizontalPaddingPx);
      const computedColumns = Math.max(
        1,
        Math.floor((availableWidthPx + gapPx) / (cellWidthPx + gapPx)),
      );

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
        ? Math.max(
            ...normalizedPlacements.map((placement) => placement.row + placement.rowSpan - 1),
          )
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

  const resolvePlacementForDrop = (
    placementItems: WidgetPlacement[],
    requestedCol: number,
    requestedRow: number,
    draggedWidgetType: WidgetType,
    sourceWidgetId: string | null,
  ) => {
    const normalizedItems = normalizePlacements(placementItems, gridColumns);
    const existingPlacement = sourceWidgetId
      ? normalizedItems.find((placement) => placement.id === sourceWidgetId)
      : null;
    const defaultSpan = widgetDefaultSpans[draggedWidgetType];
    const colSpan = Math.max(
      1,
      Math.min(existingPlacement?.colSpan ?? defaultSpan.cols, gridColumns),
    );
    const rowSpan = existingPlacement?.rowSpan ?? defaultSpan.rows;
    const occupancy = buildOccupancy(normalizedItems);
    const requestedPlacement = { col: requestedCol, row: requestedRow, colSpan, rowSpan };

    const maxOccupiedRow =
      normalizedItems.length > 0
        ? Math.max(...normalizedItems.map((placement) => placement.row + placement.rowSpan - 1))
        : 0;
    const maxScanRow = Math.max(maxOccupiedRow + rowSpan + MIN_EDIT_ROWS + 2, requestedRow + 20);

    const resolvedPlacement = canPlaceWidget(
      requestedPlacement,
      sourceWidgetId,
      occupancy,
      gridColumns,
    )
      ? requestedPlacement
      : findClosestValidOrigin(
          requestedPlacement,
          sourceWidgetId,
          occupancy,
          gridColumns,
          maxScanRow,
        );

    return {
      normalizedItems,
      existingPlacement,
      resolvedPlacement,
      colSpan,
      rowSpan,
    };
  };

  const updateDragPreview = (event: DragEvent<HTMLElement>) => {
    const draggedWidgetType =
      draggedWidget?.widgetType ??
      externalDraggedWidgetType ??
      (event.dataTransfer.getData(DRAWER_WIDGET_MIME) as WidgetType) ??
      (event.dataTransfer.getData('text/plain') as WidgetType);
    const sourceWidgetIdFromEvent = event.dataTransfer.getData(SOURCE_WIDGET_MIME);
    const sourceWidgetId =
      draggedWidget?.sourceWidgetId ??
      (sourceWidgetIdFromEvent.length > 0 ? sourceWidgetIdFromEvent : null);
    const pickupOffsetPx = draggedWidget?.pickupOffsetPx ?? null;

    if (!draggedWidgetType || !widgetLibrary.some((widget) => widget.id === draggedWidgetType)) {
      setDragPreview(null);
      return;
    }

    const pointerOrigin = getClosestGridOriginFromPointer(event, pickupOffsetPx);
    const requestedCol = pointerOrigin.col;
    const requestedRow = pointerOrigin.row;
    const { resolvedPlacement } = resolvePlacementForDrop(
      normalizedPlacements,
      requestedCol,
      requestedRow,
      draggedWidgetType,
      sourceWidgetId,
    );

    if (!resolvedPlacement) {
      setDragPreview(null);
      return;
    }

    setDragPreview((prev) => {
      if (
        prev &&
        prev.col === resolvedPlacement.col &&
        prev.row === resolvedPlacement.row &&
        prev.colSpan === resolvedPlacement.colSpan &&
        prev.rowSpan === resolvedPlacement.rowSpan
      ) {
        return prev;
      }

      return resolvedPlacement;
    });
  };

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

    const bounds = event.currentTarget.getBoundingClientRect();
    const pickupOffsetPx = {
      x: Math.max(0, event.clientX - bounds.left),
      y: Math.max(0, event.clientY - bounds.top),
    };

    setDraggedWidget({ widgetType, sourceWidgetId, pickupOffsetPx });
  };

  const onDropToCell = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isEditMode) {
      return;
    }

    const draggedWidgetType =
      draggedWidget?.widgetType ??
      externalDraggedWidgetType ??
      (event.dataTransfer.getData(DRAWER_WIDGET_MIME) as WidgetType) ??
      (event.dataTransfer.getData('text/plain') as WidgetType);
    const sourceWidgetIdFromEvent = event.dataTransfer.getData(SOURCE_WIDGET_MIME);
    const sourceWidgetId =
      draggedWidget?.sourceWidgetId ??
      (sourceWidgetIdFromEvent.length > 0 ? sourceWidgetIdFromEvent : null);
    const pickupOffsetPx = draggedWidget?.pickupOffsetPx ?? null;

    if (!draggedWidgetType || !widgetLibrary.some((widget) => widget.id === draggedWidgetType)) {
      setDraggedWidget(null);
      setDragPreview(null);
      return;
    }

    const pointerOrigin = getClosestGridOriginFromPointer(event, pickupOffsetPx);
    const requestedCol = pointerOrigin.col;
    const requestedRow = pointerOrigin.row;

    setPlacements((prev) => {
      const { normalizedItems, existingPlacement, resolvedPlacement, colSpan, rowSpan } =
        resolvePlacementForDrop(
          prev,
          requestedCol,
          requestedRow,
          draggedWidgetType,
          sourceWidgetId,
        );

      if (!resolvedPlacement) {
        return prev;
      }

      if (existingPlacement) {
        return normalizePlacements(
          normalizedItems.map((placement) =>
            placement.id === existingPlacement.id
              ? {
                  ...placement,
                  col: resolvedPlacement.col,
                  row: resolvedPlacement.row,
                  colSpan,
                  rowSpan,
                }
              : placement,
          ),
          gridColumns,
        );
      }

      const newPlacement: WidgetPlacement = {
        id: createWidgetId(draggedWidgetType),
        widgetType: draggedWidgetType,
        col: resolvedPlacement.col,
        row: resolvedPlacement.row,
        colSpan,
        rowSpan,
      };

      return normalizePlacements([...normalizedItems, newPlacement], gridColumns);
    });

    setDraggedWidget(null);
    setDragPreview(null);
  };

  const clearWidget = (widgetId: string) => {
    setPlacements((prev) => prev.filter((placement) => placement.id !== widgetId));
  };

  return (
    <section className="h-full min-h-0 p-3 sm:p-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardContent className="min-h-0 flex-1 px-4 pt-4 pb-4">
          {!isEditMode && normalizedPlacements.length === 0 ? (
            <div className="text-muted-foreground mb-3 text-sm">
              No widgets placed yet. Switch to edit mode to add widgets.
            </div>
          ) : null}

          <ScrollArea className="h-full rounded-xl">
            <div ref={canvasWidthRef} className="w-full p-3 pr-6">
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `repeat(${gridColumns}, ${GRID_CELL_WIDTH_REM}rem)`,
                  gridAutoRows: `${GRID_CELL_HEIGHT_REM}rem`,
                  gap: `${GRID_GAP_REM}rem`,
                }}
                onDragOver={
                  isEditMode
                    ? (dropEvent) => {
                        dropEvent.preventDefault();
                        dropEvent.dataTransfer.dropEffect = 'move';
                        updateDragPreview(dropEvent);
                      }
                    : undefined
                }
                onDragLeave={
                  isEditMode
                    ? (dropEvent) => {
                        const nextTarget = dropEvent.relatedTarget as Node | null;

                        if (!nextTarget || !dropEvent.currentTarget.contains(nextTarget)) {
                          setDragPreview(null);
                        }
                      }
                    : undefined
                }
                onDrop={isEditMode ? (dropEvent) => onDropToCell(dropEvent) : undefined}
              >
                {isEditMode
                  ? visibleCells.map(({ key }) => {
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
                        />
                      );
                    })
                  : null}

                {isEditMode && dragPreview ? (
                  <div
                    className="pointer-events-none z-5 rounded-lg border-2 border-primary/70 bg-primary/15"
                    style={{
                      gridColumn: `${dragPreview.col + 1} / span ${dragPreview.colSpan}`,
                      gridRow: `${dragPreview.row + 1} / span ${dragPreview.rowSpan}`,
                    }}
                  />
                ) : null}

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
                      onDragEnd={() => {
                        setDraggedWidget(null);
                        setDragPreview(null);
                      }}
                    >
                      <div
                        className={cn(
                          'h-full w-full rounded-lg p-2 transition-colors',
                          isEditMode ? 'bg-muted/25 hover:bg-muted/40' : '',
                        )}
                      >
                        <WidgetProvider
                          isEditMode={isEditMode}
                          onDelete={() => clearWidget(placement.id)}
                        >
                          <WidgetRenderer widgetType={placement.widgetType} />
                        </WidgetProvider>
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
