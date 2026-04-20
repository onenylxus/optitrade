import { BaseWidget } from './base-widget';

interface NumberWidgetProps extends Omit<React.ComponentProps<typeof BaseWidget>, 'children'> {
  value: number;
  prev?: number;
  type?: 'absolute' | 'percent';
}

export function NumberWidget({ value, prev, type = 'absolute', ...props }: NumberWidgetProps) {
  const change = prev !== undefined ? value - prev : undefined;
  const changePercent =
    prev !== undefined && prev !== 0 ? (change! / Math.abs(prev)) * 100 : undefined;
  const displayChange = type === 'percent' ? changePercent : change;

  return (
    <BaseWidget {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-bold">{value.toFixed(2)}</div>
        {change !== undefined && displayChange !== undefined && (
          <div
            className={`rounded-md px-2 py-1 text-sm text-white ${
              change > 0 ? 'bg-green-500' : change < 0 ? 'bg-red-500' : 'bg-gray-500'
            }`}
          >
            {displayChange > 0 && '+'}
            {displayChange.toFixed(2)}
            {type === 'percent' && '%'}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
