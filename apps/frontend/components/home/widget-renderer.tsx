import { CandlestickWidget } from '@/components/dashboard/candlestick-widget';
import { ChartWidget } from '@/components/dashboard/chart-widget';
import { NumberWidget } from '@/components/dashboard/number-widget';
import { TableWidget } from '@/components/dashboard/table-widget';
import { TextWidget } from '@/components/dashboard/text-widget';
import { candleData, lineConfig, lineData } from '@/app/(home)/fixtures';
import type { WidgetType } from '@/app/(home)/fixtures';

interface WidgetRendererProps {
  widgetType: WidgetType;
  showRemoveButton?: boolean;
  onRemove?: () => void;
}

export function WidgetRenderer({
  widgetType,
  showRemoveButton = false,
  onRemove,
}: WidgetRendererProps) {
  const widgetControls = {
    showRemoveButton,
    onRemove,
  };

  if (widgetType === 'number') {
    return (
      <NumberWidget
        title="Portfolio Value"
        value={182450.52}
        prev={179935.2}
        type="absolute"
        {...widgetControls}
      />
    );
  }

  if (widgetType === 'chart') {
    return (
      <ChartWidget
        title="Weekly PnL"
        description="Last 5 sessions"
        chartType="line"
        config={lineConfig}
        data={lineData}
        valueKey="pnl"
        {...widgetControls}
      />
    );
  }

  if (widgetType === 'table') {
    return (
      <TableWidget
        title="Top Positions"
        headers={['Symbol', 'Qty', 'P/L']}
        rows={[
          ['NVDA', '120', '+$1,420'],
          ['AMD', '200', '+$860'],
          ['AAPL', '80', '-$210'],
        ]}
        {...widgetControls}
      />
    );
  }

  if (widgetType === 'candlestick') {
    return (
      <CandlestickWidget
        title="QQQ 5D"
        description="Candlestick trend"
        data={candleData}
        {...widgetControls}
      />
    );
  }

  return (
    <TextWidget
      title="AI Insight"
      description="Session summary"
      isAiWidget
      text="Momentum remains positive across large-cap tech while breadth is narrowing. Keep position sizes controlled into the next macro event window."
      {...widgetControls}
    />
  );
}
