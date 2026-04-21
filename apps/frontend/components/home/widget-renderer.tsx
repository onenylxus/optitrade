import { CandlestickWidget } from '@/components/dashboard/candlestick-widget';
import { ChartWidget } from '@/components/dashboard/chart-widget';
import { NumberWidget } from '@/components/dashboard/number-widget';
import { PortfolioWidget } from '@/components/dashboard/portfolio-widget';
import { TableWidget } from '@/components/dashboard/table-widget';
import { TextWidget } from '@/components/dashboard/text-widget';
import { NewsWidget } from '@/components/dashboard/news-widget';
import { candleData, lineConfig, lineData } from '@/app/(home)/fixtures';
import type { WidgetType } from '@/app/(home)/fixtures';

interface WidgetRendererProps {
  widgetType: WidgetType;
}

export function WidgetRenderer({ widgetType }: WidgetRendererProps) {
  if (widgetType === 'number') {
    return (
      <NumberWidget title="Portfolio Value" value={182450.52} prev={179935.2} type="absolute" />
    );
  }

  if (widgetType === 'chart') {
    return (
      <ChartWidget
        title="Weekly PnL"
        chartType="line"
        config={lineConfig}
        data={lineData}
        valueKey="pnl"
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
      />
    );
  }

  if (widgetType === 'candlestick') {
    return <CandlestickWidget title="QQQ 5D" data={candleData} />;
  }

  if (widgetType === 'portfolio-small') {
    return <PortfolioWidget title="Portfolio" variant="small" />;
  }

  if (widgetType === 'portfolio-medium') {
    return <PortfolioWidget title="Portfolio Snapshot" variant="medium" />;
  }

  if (widgetType === 'portfolio-large') {
    return <PortfolioWidget title="Portfolio Snapshot" variant="large" />;
  }

  if (widgetType === 'news') {
    return <NewsWidget />;
  }
  return (
    <TextWidget
      title="AI Insight"
      text="Momentum remains positive across large-cap tech while breadth is narrowing. Keep position sizes controlled into the next macro event window."
    />
  );
}
