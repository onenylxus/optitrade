import type { WidgetPlacement, WidgetType } from '@/app/(home)/fixtures';
import { widgetDefaultSpans } from '@/app/(home)/fixtures';

const WIDGET_LAYOUT_VERSION = 1;

const ALLOWED_WIDGET_TYPES = new Set<WidgetType>([
  'number',
  'chart',
  'table',
  'text',
  'candlestick',
  'portfolio-small',
  'portfolio-medium',
  'portfolio-large',
  'news',
]);

interface SerializedWidgetLayoutV1 {
  version: 1;
  placements: WidgetPlacement[];
}

function toSafeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value);
}

function isAllowedWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && ALLOWED_WIDGET_TYPES.has(value as WidgetType);
}

function parsePlacement(value: unknown): WidgetPlacement | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WidgetPlacement>;
  const col = toSafeInteger(candidate.col);
  const row = toSafeInteger(candidate.row);
  const colSpan = toSafeInteger(candidate.colSpan);
  const rowSpan = toSafeInteger(candidate.rowSpan);

  if (
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    !isAllowedWidgetType(candidate.widgetType) ||
    col === null ||
    row === null ||
    colSpan === null ||
    rowSpan === null
  ) {
    return null;
  }

  return {
    id: candidate.id,
    widgetType: candidate.widgetType,
    col: Math.max(0, col),
    row: Math.max(0, row),
    colSpan: Math.max(1, colSpan),
    rowSpan: Math.max(1, rowSpan),
  };
}

function sortPlacements(placements: WidgetPlacement[]): WidgetPlacement[] {
  return [...placements].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    if (left.col !== right.col) {
      return left.col - right.col;
    }

    return left.id.localeCompare(right.id);
  });
}

export function applyWidgetLayoutMigrations(placements: WidgetPlacement[]): WidgetPlacement[] {
  const mediumSpan = widgetDefaultSpans['portfolio-medium'];

  return placements.map((placement) => {
    if (placement.widgetType !== 'portfolio-medium') {
      return placement;
    }

    if (placement.colSpan === mediumSpan.cols && placement.rowSpan === mediumSpan.rows) {
      return placement;
    }

    return {
      ...placement,
      colSpan: mediumSpan.cols,
      rowSpan: mediumSpan.rows,
    };
  });
}

export function serializeWidgetLayout(placements: WidgetPlacement[]): string {
  const payload: SerializedWidgetLayoutV1 = {
    version: WIDGET_LAYOUT_VERSION,
    placements: sortPlacements(placements),
  };

  return JSON.stringify(payload);
}

export function deserializeWidgetLayout(serializedLayout: string): WidgetPlacement[] | null {
  if (serializedLayout.trim().length === 0) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(serializedLayout) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const parsedLayout = parsed as Partial<SerializedWidgetLayoutV1>;

  if (parsedLayout.version !== WIDGET_LAYOUT_VERSION || !Array.isArray(parsedLayout.placements)) {
    return null;
  }

  const placements = parsedLayout.placements
    .map((placement) => parsePlacement(placement))
    .filter((placement): placement is WidgetPlacement => placement !== null);

  return placements;
}
