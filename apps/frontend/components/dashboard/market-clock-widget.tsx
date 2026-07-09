'use client';

import { useEffect, useState, useCallback } from 'react';
import { BaseWidget } from './base-widget';

// ── Market phases ────────────────────────────────────────────────────────────
type Phase = 'closed' | 'pre_market' | 'regular' | 'after_hours';

const PRE_MKT_OPEN = 4 * 60;          // 04:00 ET
const REGULAR_OPEN = 9 * 60 + 30;     // 09:30 ET
const REGULAR_CLOSE = 16 * 60;        // 16:00 ET
const AFTER_HRS_CLOSE = 20 * 60;      // 20:00 ET

const PHASE_META: Record<Phase, { label: string; color: string; badge: string }> = {
  closed:      { label: 'Market Closed',   color: '#94a3b8', badge: 'CLOSED' },
  pre_market:  { label: 'Pre-Market',      color: '#f59e0b', badge: 'PRE-MARKET' },
  regular:     { label: 'Regular Session', color: '#22c55e', badge: 'OPEN' },
  after_hours: { label: 'After Hours',     color: '#a78bfa', badge: 'AFTER-HOURS' },
};

const PHASE_COLORS = {
  pre: '#f59e0b',
  regular: '#22c55e',
  after: '#a78bfa',
} as const;

// ── ET helpers ───────────────────────────────────────────────────────────────
// All scheduling logic uses ET (NYSE's timezone), not the viewer's local time.
function getETParts(date: Date): {
  year: number; month: number; day: number; dow: number;
  hours: number; minutes: number; totalMinutes: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(date);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hours = parseInt(get('hour'), 10) % 24; // Intl returns 24 for midnight in some locales
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    hours,
    minutes: parseInt(get('minute'), 10),
    totalMinutes: hours * 60 + parseInt(get('minute'), 10),
  };
}

// ── US Holidays (NYSE closed) ────────────────────────────────────────────────
// Compute all holiday dates for the year, then check membership.
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + 7 * (n - 1)));
}

function getGoodFriday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31);
  const day = ((h + l - 7 * m2 + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day - 2));
}

function getUSHolidaysForYear(year: number): Array<{ ymd: string; name: string }> {
  const mk = (m: number, d: number, name: string) => ({
    ymd: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    name,
  });
  const mlk = nthWeekday(year, 0, 1, 3); // 3rd Monday in January
  const presidents = nthWeekday(year, 1, 1, 3); // 3rd Monday in February
  const memorial = nthWeekday(year, 4, 1, -1); // Last Monday in May
  const labor = nthWeekday(year, 8, 1, 1); // 1st Monday in September
  const thanksgiving = nthWeekday(year, 10, 4, 4); // 4th Thursday in November

  return [
    mk(1, 1, "New Year's Day"),
    { ymd: etYmd(mlk), name: 'Martin Luther King Jr. Day' },
    { ymd: etYmd(presidents), name: 'Presidents Day' },
    { ymd: etYmd(getGoodFriday(year)), name: 'Good Friday' },
    { ymd: etYmd(memorial), name: 'Memorial Day' },
    mk(6, 19, 'Juneteenth'),
    mk(7, 4, 'Independence Day'),
    { ymd: etYmd(labor), name: 'Labor Day' },
    { ymd: etYmd(thanksgiving), name: 'Thanksgiving Day' },
    mk(12, 25, 'Christmas Day'),
  ];
}

function etYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getHolidayForETDate(et: { year: number; month: number; day: number }): { name: string } | null {
  const ymd = `${et.year}-${String(et.month).padStart(2, '0')}-${String(et.day).padStart(2, '0')}`;
  const holidays = [
    ...getUSHolidaysForYear(et.year),
    ...getUSHolidaysForYear(et.year + 1), // include year boundary
  ];
  const found = holidays.find((h) => h.ymd === ymd);
  return found ? { name: found.name } : null;
}

// ── Phase detection on ET ────────────────────────────────────────────────────
function phaseFromET(etMins: number): Phase {
  if (etMins >= PRE_MKT_OPEN && etMins < REGULAR_OPEN) return 'pre_market';
  if (etMins >= REGULAR_OPEN && etMins < REGULAR_CLOSE) return 'regular';
  if (etMins >= REGULAR_CLOSE && etMins < AFTER_HRS_CLOSE) return 'after_hours';
  return 'closed';
}

// ── Countdown math (all in ET minutes) ───────────────────────────────────────
function findNextTradingDayET(
  startEt: { year: number; month: number; day: number; dow: number; totalMinutes: number },
  holidays: Array<{ ymd: string }>,
): { year: number; month: number; day: number; dow: number } {
  // Walk forward day by day until we find a non-weekend, non-holiday day.
  let { year, month, day, dow } = startEt;
  const holidaySet = new Set([
    ...holidays.map((h) => h.ymd),
  ]);
  for (let i = 0; i < 14; i += 1) {
    const candidateYmd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend && !holidaySet.has(candidateYmd)) {
      return { year, month, day, dow };
    }
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
    dow = (dow + 1) % 7;
  }
  // Fallback: 14 days from now (should never hit)
  return { year, month, day, dow };
}

function getCountdown(
  phase: Phase,
  etMins: number,
  et: { year: number; month: number; day: number; dow: number; totalMinutes: number },
  holiday: { name: string } | null,
): { label: string; countdown: string; minutes: number } {
  const fmtCountdown = (mins: number): string => {
    if (mins < 0) return '00:00';
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Holidays/weekends: jump to the next trading day's pre-market open.
  const isWeekend = et.dow === 0 || et.dow === 6;
  const isHoliday = !!holiday;
  const isSpecialClosed = isWeekend || isHoliday;

  if (isSpecialClosed) {
    // Find next trading day
    const nextDay = findNextTradingDayET(et, getUSHolidaysForYear(et.year));
    // Compute "minutes from now" assuming the pre-market open is PRE_MKT_OPEN
    // minutes past the next day's ET midnight, and we're currently at et.totalMinutes
    // past today's ET midnight. The total delta = daysDelta * 1440 + (PRE_MKT_OPEN - et.totalMinutes).
    const todayUtcMs = Date.UTC(et.year, et.month - 1, et.day);
    const nextUtcMs = Date.UTC(nextDay.year, nextDay.month - 1, nextDay.day);
    const daysDelta = Math.round((nextUtcMs - todayUtcMs) / 86400000);
    const minutes = daysDelta * 1440 + (PRE_MKT_OPEN - et.totalMinutes);
    const label = isHoliday
      ? `${holiday!.name} — reopens in`
      : 'Pre-market reopens in';
    return { label, countdown: fmtCountdown(minutes), minutes };
  }

  if (phase === 'closed') {
    // Before today's pre-market: countdown to today's PRE_MKT_OPEN.
    // After today's after-hours: countdown to tomorrow's pre-market (which is
    // tomorrow's PRE_MKT_OPEN; tomorrow might not be a trading day, but we still
    // want an honest "8h" countdown rather than a wrong date).
    let minutes: number;
    if (et.totalMinutes < PRE_MKT_OPEN) {
      minutes = PRE_MKT_OPEN - et.totalMinutes;
      return { label: 'Pre-market opens in', countdown: fmtCountdown(minutes), minutes };
    }
    if (et.totalMinutes >= AFTER_HRS_CLOSE) {
      // Tomorrow's pre-market — even if tomorrow is a weekend/holiday, show the
      // wall-clock countdown; the phase will reflect the actual market state on
      // next tick. Avoids the old "Closes in 23:55" bug.
      minutes = 1440 - et.totalMinutes + PRE_MKT_OPEN;
      return { label: 'Pre-market opens in', countdown: fmtCountdown(minutes), minutes };
    }
    // Between after-hours close and next state: shouldn't hit, but be safe.
    return { label: 'Market Closed', countdown: '00:00', minutes: 0 };
  }

  if (phase === 'pre_market') {
    return { label: 'Regular opens in', countdown: fmtCountdown(REGULAR_OPEN - et.totalMinutes), minutes: REGULAR_OPEN - et.totalMinutes };
  }

  if (phase === 'regular') {
    return { label: 'Closes in', countdown: fmtCountdown(REGULAR_CLOSE - et.totalMinutes), minutes: REGULAR_CLOSE - et.totalMinutes };
  }

  // after_hours — countdown to next pre-market (tomorrow morning)
  return { label: 'Reopens in', countdown: fmtCountdown(1440 - et.totalMinutes + PRE_MKT_OPEN), minutes: 1440 - et.totalMinutes + PRE_MKT_OPEN };
}

// ── SVG arc primitives ──────────────────────────────────────────────────────
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const sweep = ((endAngle - startAngle) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// Map ET minutes (0–1439) to SVG angle 0–360
function etMinsToAngle(etMins: number): number {
  const normalised = ((etMins % 1440) + 1440) % 1440;
  return (normalised / 1440) * 360;
}

// ── Clock face (24-hour ET) ─────────────────────────────────────────────────
function ClockFace({ cx, cy, r, hours, minutes, seconds }: {
  cx: number; cy: number; r: number;
  hours: number; minutes: number; seconds: number;
}) {
  // 24h clock — hour hand completes one rotation per 24h
  const secDeg = (seconds / 60) * 360;
  const minDeg = ((minutes + seconds / 60) / 60) * 360;
  const hrDeg  = ((hours + minutes / 60) / 24) * 360;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  return (
    <>
      <line x1={cx} y1={cy}
        x2={cx + (r - 6)  * Math.cos(toRad(secDeg))}
        y2={cy + (r - 6)  * Math.sin(toRad(secDeg))}
        stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" suppressHydrationWarning />
      <line x1={cx} y1={cy}
        x2={cx + (r - 16) * Math.cos(toRad(minDeg))}
        y2={cy + (r - 16) * Math.sin(toRad(minDeg))}
        stroke="#475569" strokeWidth={2.5} strokeLinecap="round" suppressHydrationWarning />
      <line x1={cx} y1={cy}
        x2={cx + r * 0.52 * Math.cos(toRad(hrDeg))}
        y2={cy + r * 0.52 * Math.sin(toRad(hrDeg))}
        stroke="#0f172a" strokeWidth={3.5} strokeLinecap="round" suppressHydrationWarning />
      <circle cx={cx} cy={cy} r={4.5} fill="#0f172a" />
      <circle cx={cx} cy={cy} r={2}   fill="#f8fafc" />
    </>
  );
}

function HourMarkers({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      {Array.from({ length: 24 }, (_, h) => {
        const angleDeg = (h / 24) * 360 - 90;
        const rad = (angleDeg * Math.PI) / 180;
        const isMajor = h % 6 === 0;
        const inner = r - (isMajor ? 9 : 5);
        const outer = r;
        return (
          <line key={h}
            x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
            x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
            stroke="currentColor"
            strokeWidth={isMajor ? 2 : 1}
            strokeOpacity={isMajor ? 0.6 : 0.3}
            suppressHydrationWarning
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const rad = ((h / 24) * 360 - 90) * Math.PI / 180;
        const labelR = r - 18;
        return (
          <text key={h}
            x={cx + labelR * Math.cos(rad)}
            y={cy + labelR * Math.sin(rad)}
            textAnchor="middle" dominantBaseline="central"
            fontSize={9} fill="currentColor" fillOpacity={0.5}
            suppressHydrationWarning
          >
            {h === 0 ? '00' : h.toString().padStart(2, '0')}
          </text>
        );
      })}
    </>
  );
}

function PhaseArc({ cx, cy, r, openMins, closeMins, color }: {
  cx: number; cy: number; r: number;
  openMins: number; closeMins: number; color: string;
}) {
  const start = etMinsToAngle(openMins);
  const end   = etMinsToAngle(closeMins);
  const path  = describeArc(cx, cy, r, start, end);
  return (
    <>
      <path d={path} stroke={color} strokeWidth={10} fill="none"
        strokeLinecap="round" opacity={0.85} />
      <path d={path} stroke={color} strokeWidth={10} fill="none"
        strokeLinecap="round" opacity={0.25} style={{ filter: 'blur(3px)' }} />
    </>
  );
}

// ── Widget ───────────────────────────────────────────────────────────────────
interface MarketClockWidgetProps extends Omit<React.ComponentProps<typeof BaseWidget>, 'title' | 'children'> {}

export function MarketClockWidget(props: MarketClockWidgetProps) {
  const [now, setNow] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  const tick = useCallback(() => setNow(new Date()), []);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // ET = UTC-4 (EDT) or UTC-5 (EST). Recompute once per render.
  const et = getETParts(now);
  // HKT = UTC+8. Compute separately for the small HKT tag.
  const hkt = new Date(now.getTime() + 8 * 3600000);
  const hktHm = `${String(hkt.getUTCHours()).padStart(2, '0')}:${String(hkt.getUTCMinutes()).padStart(2, '0')}`;

  // Holiday check uses the ET date (avoids mis-identifying July 4/5 around HKT midnight)
  const holiday = getHolidayForETDate(et);
  const isWeekend = et.dow === 0 || et.dow === 6;
  const isSpecialClosed = isWeekend || !!holiday;
  const phase: Phase = isSpecialClosed ? 'closed' : phaseFromET(et.totalMinutes);
  const meta = PHASE_META[phase];
  const { label: countdownLabel, countdown } = getCountdown(phase, et.totalMinutes, et, holiday);

  const svgSize = 180;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r  = svgSize / 2 - 12;
  const innerR = r - 14;

  const etHm = `${String(et.hours).padStart(2, '0')}:${String(et.minutes).padStart(2, '0')}`;

  const contextText = `${meta.label} · ET ${etHm} · ${countdownLabel} ${countdown}`;

  return (
    <BaseWidget
      title="US Market Clock"
      contextData={{ label: 'Market Clock', text: contextText }}
      createdByNanobot
      {...props}
    >
      <div className="flex flex-col items-center gap-2 py-1">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="shrink-0">
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="currentColor" strokeOpacity={0.06} />
          <circle cx={cx} cy={cy} r={r}      fill="none" stroke="currentColor" strokeOpacity={0.12} />

          {/* Phase arcs */}
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={PRE_MKT_OPEN}   closeMins={REGULAR_OPEN}  color={PHASE_COLORS.pre} />
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={REGULAR_OPEN}  closeMins={REGULAR_CLOSE} color={PHASE_COLORS.regular} />
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={REGULAR_CLOSE} closeMins={AFTER_HRS_CLOSE} color={PHASE_COLORS.after} />

          <g color="currentColor">
            <HourMarkers cx={cx} cy={cy} r={r} />
          </g>

          {mounted && (
            <ClockFace cx={cx} cy={cy} r={r}
              hours={et.hours} minutes={et.minutes} seconds={now.getSeconds()} />
          )}
        </svg>

        {/* Countdown + Status */}
        <div className="flex items-center gap-6 w-full justify-center">
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground" suppressHydrationWarning>
              {countdownLabel}
            </div>
            <div className="font-mono text-xl font-bold tabular-nums"
              style={{ color: meta.color }} suppressHydrationWarning>
              {countdown}
            </div>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col items-center">
            <div className="mb-1 flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide"
              style={{ backgroundColor: meta.color + '22', color: meta.color }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: meta.color,
                  boxShadow: phase !== 'closed' ? `0 0 4px ${meta.color}` : undefined,
                  animation: phase !== 'closed' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}
              />
              {meta.badge}
            </div>
            <div className="font-mono text-sm text-muted-foreground" suppressHydrationWarning>
              ET {etHm} · HKT {hktHm}
            </div>
          </div>
        </div>

        {/* Phase legend */}
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          {[
            { label: 'Pre-Market',   color: PHASE_COLORS.pre,     range: '04:00 – 09:30 ET' },
            { label: 'Regular',      color: PHASE_COLORS.regular, range: '09:30 – 16:00 ET' },
            { label: 'After-Hours',  color: PHASE_COLORS.after,   range: '16:00 – 20:00 ET' },
          ].map(({ label, color, range }) => (
            <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span>{label} {range}</span>
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
