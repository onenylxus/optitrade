# Nanobot Widgets Documentation

Four widgets built and maintained by **OptiTrade's AI agent (nanobot)**:
- **Market Clock** — live US market status with 24h analogue clock
- **Paper Trading History** — trade log with stats and entry rationale
- **Daily Market Prediction** — AI-generated daily market outlook
- **Earnings Calendar** — upcoming earnings with urgency flags

---

## Market Clock Widget

### Purpose
Displays the current US market phase (open/closed/pre-market/after-hours) with a live 24-hour analogue clock. Countdown shows time until next phase transition.

### How It Works

The widget runs entirely client-side — no API calls. Time and phase are computed from the browser's clock every second.

**Timezone logic** (HKT = UTC+8, ET = UTC-4/-5):

| Phase | ET Hours | HKT Hours |
|---|---|---|
| Pre-Market | 4:00 AM – 9:30 AM | EDT: 16:00–21:30 / EST: 17:00–22:30 |
| Regular | 9:30 AM – 4:00 PM | EDT: 21:30–04:00+1d / EST: 22:30–05:00+1d |
| After-Hours | 4:00 PM – 8:00 PM | EDT: 04:00–08:00+1d / EST: 05:00–09:00+1d |

DST detection uses the standard US rule (second Sunday March → first Sunday November).

### Key Functions

- **`isDst()`** — determines EDT vs EST based on current date vs DST boundaries.
- **`buildSession()`** — returns phase boundaries in HKT minutes from midnight (can exceed 1440 for next-day ranges).
- **`inRange()`** — handles midnight-crossing ranges correctly (e.g. regular closes at minute 1680 = 04:00 next day).
- **`isUSHoliday()`** — checks all NYSE holidays including Good Friday (computed via the Gaussian Easter algorithm).
- **`getCountdown()`** — returns `label` + `countdown` string for the current phase.

### Clock Face

- **24-hour dial** with hour markers at 0, 6, 12, 18 (major) and all others (minor).
- **Three hands**: hour (thickest, navy), minute (medium, slate), second (thinnest, red).
- **Phase arcs**: colored rings on the clock rim showing pre-market (amber), regular (green), after-hours (purple).
- **Phase arc bug fix**: `minsToAngle` uses modulo normalization — prevents arcs from rendering flat when `openMins`/`closeMins` exceed 1440.

### Holidays Covered
New Year's Day, MLK Day, Presidents Day, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas.

### Key Design Decisions
- **No API dependency** — works offline, updates every second.
- **SVG arc fix**: `Math.sin`/`Math.cos` corrected in `describeArc`; hour hand uses 24h scale (not 12h) so it completes one rotation per day.
- **`suppressHydrationWarning`** on all dynamic SVG elements to avoid SSR mismatch.
- Countdown on weekends/holidays targets the next Monday pre-market open.

---

## Paper Trading History Widget

### Purpose
Displays the full paper trading history from the AI4Trade copy-trading system, including open and closed positions, entry rationale, and P&L stats.

### Data Flow

```
/root/optitrade-clone/apps/backend/data/paper_portfolios.json
  → GET /api/paper-trading/history   (Next.js API route)
    → PaperTradingHistoryWidget.tsx  (frontend)
```

**API route** (`apps/frontend/app/api/paper-trading/history/route.ts`):
- Uses an **absolute path** (`/root/optitrade-clone/apps/backend/data/paper_portfolios.json`) to avoid Next.js `process.cwd()` resolution issues in dev mode.
- Returns `{ positions, open, closed, stats }` where `positions` is the full array of trades.

### Interface (Trade Object)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique trade ID |
| `symbol` | `string` | Ticker symbol |
| `strategy` | `string` | Strategy label (e.g. "WSB FOMO", "Momentum") |
| `side` | `"LONG"` \| `"SHORT"` | Direction |
| `status` | `"open"` \| `"closed"` | Open or closed |
| `entry_price` | `number` | Entry price |
| `currentPrice` | `number` | Exit price (if closed) or last known price |
| `live_price` | `number?` | Live price from broker (optional) |
| `quantity` | `number` | Share count |
| `target_price` | `number` | Take-profit target |
| `stop_loss` | `number` | Stop-loss price |
| `pnl_pct` | `number` | Unrealized or realized P&L % |
| `close_reason` | `"STOP_LOSS"` \| `"TARGET_HIT"` \| `"TRAILING_STOP"` \| `"CLOSE"` \| `null` | Exit reason |
| `closed_at` | `string?` | ISO timestamp when closed |
| `sector` | `string` | Sector label |
| `notes` | `string` | Entry rationale (why this trade was taken) |
| `created_at` | `string` | ISO timestamp when opened |

### UI Components

- **StatsBar** — shows win rate, avg win/loss %, total P&L once closed trades exist. Hidden when all positions are open.
- **Tabs** — `All / Open / Closed` filter.
- **TradeCard** (per position):
  - **Always visible**: Symbol badge, LONG/SHORT tag, strategy tag, status badge (OPEN or exit reason), P&L %, entry rationale (from `notes` field).
  - **Quick stats row**: Entry price, current/live price, target, stop, quantity, sector.
  - **Expandable** (click chevron): Max loss %, upside %, open date, close date.

### Exit Reason Badges

| Badge | Color | Meaning |
|---|---|---|
| `STOP_LOSS` | Red | Hit max loss threshold |
| `TARGET_HIT` | Green | Hit take-profit target |
| `TRAILING_STOP` | Blue | Trailing stop triggered |
| `CLOSE` | Gray | Manual close |
| `OPEN` | Blue | Still active |

### Key Design Decisions

- **"Why I entered" section is always visible** — not collapsed — because trade rationale is the most important signal for learning.
- **Stats are hidden until first closed trade** — avoids showing a half-filled stats bar when there are only open positions.
- **`Array.isArray` guards throughout** — the API route normalizes response shape but the widget guards against `null` / `{ error }` responses to prevent `filter is not a function` crashes.
- **Live fallback**: if backend fetch fails, widget falls back to the Next.js proxy path.

---

## Daily Market Prediction Widget

### Purpose
Displays an AI-generated daily market outlook powered by live price data from the backend. Refreshes on each page load.

### Data Flow

```
yfinance (backend)
  → GET /api/price/{SPY|QQQ|^VIX}   (FastAPI backend route)
    → GET /api/prediction/daily      (Next.js API route)
      → DailyPredictionWidget.tsx    (frontend)
```

**API route** (`apps/frontend/app/api/prediction/daily/route.ts`):
1. Fetches live SPY, QQQ, and VIX prices from the FastAPI backend with a 5-second timeout.
2. Falls back to defaults (`SPY: 733.58`, `QQQ: 713.65`, `VIX: 19.49`) if any fetch fails.
3. Generates a structured `Prediction` object using VIX-based rules (see below).
4. Returns the prediction JSON to the frontend.

### Prediction Schema

```ts
interface Prediction {
  date: string;               // Human-readable date string
  outlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
  vix: number;
  fearGreed: number;           // Derived from VIX (0–100 scale)
  marketSummary: string;       // One-sentence market context
  keyLevels: {                 // SPY / QQQ ±1.5% bands
    spy_upper, spy_lower,
    qqq_upper, qqq_lower
  };
  topSignals: [{               // Top 5 trade signals
    symbol, direction, reason, confidence
  }];
  sectorPicks: [{              // Sector stance
    sector, stance, reason
  }];
  catalystCalendar: [{          // Upcoming events
    event, date, impact
  }];
  risks: string[];             // Key risk flags
}
```

### VIX → Outlook Logic

| VIX Range | Outlook | Fear & Greed |
|---|---|---|
| < 12 | BULLISH | 72 (Extreme Greed) |
| 12 – 14.99 | BULLISH | 52 |
| 15 – 19.99 | BULLISH | 52 |
| 20 – 24.99 | NEUTRAL | 38 |
| ≥ 25 | VOLATILE | 15–25 (Fear/Extreme Fear) |

### UI Sections

1. **Outlook Banner** — colored banner with icon (↑ ↓ → ⚠), label, and one-sentence market summary.
2. **VIX + Fear & Greed Bar** — VIX number with color coding; Fear & Greed horizontal bar with label.
3. **Key Levels** — SPY/QQQ upper/lower bands at ±1.5% from current price.
4. **Top Signals** — Top 5 tickers with direction (LONG/SHORT) and 1–5 star confidence.
5. **Sector Picks** — OVERWEIGHT / UNDERWEIGHT / NEUTRAL with color badges.
6. **Catalyst Calendar** — Upcoming events with impact badges (HIGH/MEDIUM/LOW).
7. **Key Risks** — Bulleted risk flags in an orange-bordered alert box.

### Key Design Decisions

- **Live data or bust**: if the backend is unreachable, the widget still renders with fallback defaults rather than an error state.
- **Regenerates on every page load** — no caching. Each refresh = fresh prediction.
- **Confidence stars (1–5)** — quick visual signal strength without numerical clutter.
- **Empty state**: shows "No prediction available — check back after market open" when fetch fails entirely.

---

## Earnings Calendar Widget

### Purpose
Shows upcoming earnings releases for portfolio and watchlist stocks, with urgency flags and BMO/AMC timing.

### Data Flow
```
yfinance (Phase 2 cron) → /api/earnings → EarningsWidget.tsx
```
Currently shows demo data (hardcoded 2026 earnings list) until Phase 2 backend cron is wired.

### Schema (EarningItem)

```ts
interface EarningItem {
  ticker: string;
  companyName: string;
  date: string;          // ISO date string
  time: 'BMO' | 'AMC';  // Before/After market open
  epsEstimate: number | null;
  epsActual: number | null;
  surprise: number | null;  // % beat/miss
  fiscalPeriod: string;     // e.g. "Q2 FY26"
}
```

### Features

- **Filter bar**: "All Stocks" vs "Portfolio Only" (matches against live portfolio symbols).
- **Urgency badges**: rows within 2 days = red, within 5 days = amber.
- **Sort order**: unreported first, then by date ascending.
- **EPS columns**: estimate, actual (filled post-release), surprise % (color-coded green/red).
- **Portfolio highlight**: rows where ticker matches current portfolio get a subtle red tint.

### Phase 2 Notes
Backend should populate `/api/earnings` via a daily cron using yfinance and persist to `data/earnings.json`. The widget currently falls back to demo data on fetch failure.

---

## Shared Architecture Notes

- All nanobot widgets use `'use client'` — client-side rendering only.
- All extend `BaseWidget` with `createdByNanobot` flag.
- All import `BACKEND_URL` from `@/lib/api/client` for the backend proxy path.
- All include loading states and error/empty states.
- Widget files live in `apps/frontend/components/dashboard/`.
- API routes live in `apps/frontend/app/api/<route>/route.ts`.

## Adding a New Widget

1. **Backend data** (if needed): add a Python fetcher in `apps/backend/src/` + register route in `main.py`, OR add a Next.js API route reading from local files. Use **absolute paths** for file reads in Next.js API routes to avoid `process.cwd()` issues.
2. **Frontend component**: create `components/dashboard/<name>-widget.tsx`, extend `BaseWidget`.
3. **Register**: add `WidgetType.<NAME> = '<name>'` in `fixtures.ts` and map it in `widgetLibrary`.
4. **Wire renderer**: add to `WidgetRenderer`'s render switch.
5. **Git**: escape parentheses in paths — e.g. `git add 'app/\(home)/'`.
6. **Data guards**: always guard `Array.isArray` before calling `.filter()`/`.map()` on fetched data. The API may return `{ error }` or `null` on failure.
