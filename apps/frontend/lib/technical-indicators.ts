import type { CandlestickData, LineData, Time } from 'lightweight-charts';

/** Simple moving average on close → line series points. */
export function computeMASeries(
  data: CandlestickData<Time>[],
  period: number,
): LineData<Time>[] {
  if (data.length < period) {
    return [];
  }
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

/** Bollinger bands (SMA middle, ±k·σ). */
export function computeBollingerSeries(
  data: CandlestickData<Time>[],
  period: number,
  multiplier: number,
): { upper: LineData<Time>[]; middle: LineData<Time>[]; lower: LineData<Time>[] } {
  const upper: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  if (data.length < period) {
    return { upper, middle, lower };
  }

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const closes = slice.map((c) => c.close);
    const mean = closes.reduce((a, b) => a + b, 0) / period;
    const variance =
      closes.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / period;
    const std = Math.sqrt(variance);
    const t = data[i].time;
    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + multiplier * std });
    lower.push({ time: t, value: mean - multiplier * std });
  }

  return { upper, middle, lower };
}

/**
 * RSI (Wilder / SMMA smoothing), 0–100.
 * First value is emitted at index `period` (need `period`+1 closes).
 */
export function computeRSISeries(
  data: CandlestickData<Time>[],
  period = 14,
): LineData<Time>[] {
  if (data.length < period + 1) {
    return [];
  }

  const closes = data.map((d) => d.close);
  const result: LineData<Time>[] = [];

  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) {
      sumGain += ch;
    } else {
      sumLoss -= ch;
    }
  }

  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;

  const rsiValue = () => {
    if (avgLoss === 0) {
      return 100;
    }
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  result.push({ time: data[period].time, value: rsiValue() });

  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: data[i].time, value: rsiValue() });
  }

  return result;
}
