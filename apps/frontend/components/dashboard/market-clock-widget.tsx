'use client';

import { useEffect, useState, useCallback } from 'react';
import { BaseWidget } from './base-widget';

// ── Market phases ────────────────────────────────────────────────────────────
// NYSE regular:  9:30 AM – 4:00 PM ET  (6.5 hours)
// Pre-market:    4:00 AM – 9:30 AM ET  (5.5 hours)
// After-hours:   4:00 PM – 8:00 PM ET  (4 hours)
// HKT = ET + 12h (standard) or + 13h (DST).

type Phase = 'closed' | 'pre_market' | 'regular' | 'after_hours';

interface MarketSession {
  phase: Phase;
  // Pre-market: 21:30 – 00:00 HKT (next day ET 04:00–09:30) → 21:30–24:00
  // Regular:    00:00 – 04:00 HKT (same day ET 09:30–16:00)
  // After-hrs: 04:00 – 08:00 HKT (same day ET 16:00–20:00)
  // We store them as continuous minutes from HKT midnight (00:00 today).
  // Wrap-around is handled by normalising: if open > close, the range wraps midnight.
  preMkt:   { open: number; close: number; label: string; range: string; color: string };
  regular:  { open: number; close: number; label: string; range: string; color: string };
  afterHrs: { open: number; close: number; label: string; range: string; color: string };
}

function fmtHour(h: number): { str: string; nextDay: boolean } {
  // h is continuous minutes; may exceed 1440 (next calendar day)
  const excess = Math.floor(h / 1440);
  const mins = h % 1440;
  const hour = Math.floor(mins / 60);
  const min  = Math.round(mins % 60);
  return {
    str: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    nextDay: excess > 0,
  };
}

function fmtRange(open: number, close: number): string {
  // The +1d marker clarifies when the range wraps to the next calendar day
  const o = fmtHour(open);
  const c = fmtHour(close);
  const nextDay = o.nextDay || c.nextDay;
  return `${o.str} – ${c.str}${nextDay ? ' +1d' : ''}`;
}

function isDst(): boolean {
  // ET DST: second Sunday March 02:00 → first Sunday November 02:00
  const now = new Date();
  const year = now.getFullYear();
  // Second Sunday March
  const mar1 = new Date(year, 2, 1);
  const marSecondSun = mar1.getDay() === 0 ? 8 : 15 - mar1.getDay();
  const dstStart = new Date(year, 2, marSecondSun, 2, 0, 0);
  // First Sunday November
  const nov1 = new Date(year, 10, 1);
  const novFirstSun = nov1.getDay() === 0 ? 1 : 8 - nov1.getDay();
  const dstEnd = new Date(year, 10, novFirstSun, 2, 0, 0);
  return now >= dstStart && now < dstEnd;
}

function buildSession(): MarketSession {
  // HKT times derived from ET session windows:
  //   EDT (summer): ET is UTC-4, HKT is UTC+8 → HKT = ET + 12h
  //   EST (winter): ET is UTC-5, HKT is UTC+8 → HKT = ET + 13h
  //
  // US Summer (EDT, mid-March → early November):
  //   Pre-Market:  04:00–09:30 ET → 16:00–21:30 HKT
  //   Regular:     09:30–16:00 ET → 21:30–04:00 HKT next day
  //   After-Hours: 16:00–20:00 ET → 04:00–08:00 HKT next day
  //
  // US Winter (EST, early November → mid-March):
  //   Pre-Market:  04:00–09:30 ET → 17:00–22:30 HKT
  //   Regular:     09:30–16:00 ET → 22:30–05:00 HKT next day
  //   After-Hours: 16:00–20:00 ET → 05:00–09:00 HKT next day
  const edt = isDst();
  const session = edt
    ? {
        phase: 'closed' as Phase,
        preMkt:   { open: 16*60,      close: 21*60+30,  label: 'Pre-Market',   range: '16:00 – 21:30',           color: '#f59e0b' },
        regular:  { open: 21*60+30,   close: 28*60,      label: 'Regular',      range: '21:30 – 04:00 +1d',        color: '#22c55e' },
        afterHrs: { open: 28*60,       close: 32*60,      label: 'After-Hours', range: '04:00 – 08:00 +1d',        color: '#a78bfa' },
      }
    : {
        phase: 'closed' as Phase,
        preMkt:   { open: 17*60,      close: 22*60+30,  label: 'Pre-Market',   range: '17:00 – 22:30',           color: '#f59e0b' },
        regular:  { open: 22*60+30,   close: 29*60,      label: 'Regular',      range: '22:30 – 05:00 +1d',        color: '#22c55e' },
        afterHrs: { open: 29*60,       close: 33*60,      label: 'After-Hours', range: '05:00 – 09:00 +1d',        color: '#a78bfa' },
      };
  return session;
}

function getPhaseAndSession(): { session: MarketSession; phase: Phase } {
  const session = buildSession();

  // HKT minutes from today's midnight
  const now = new Date();
  const hkt = new Date(now.getTime() + (8 * 3600000) - (now.getTimezoneOffset() * 60000));
  const hktMins = hkt.getHours() * 60 + hkt.getMinutes(); // 0–1439

  const { preMkt, regular, afterHrs } = session;

  // Continuous comparison with midnight-crossing awareness
  // If a range crosses midnight (close > 1440), we extend hktMins by adding 1440
  const inRange = (open: number, close: number, mins: number): boolean => {
    if (close > 1440) {
      // crosses midnight: match if mins >= open OR mins + 1440 < close
      return mins >= open || mins + 1440 < close;
    }
    return mins >= open && mins < close;
  };

  if (inRange(preMkt.open, preMkt.close, hktMins)) {
    session.phase = 'pre_market';
  } else if (inRange(regular.open, regular.close, hktMins)) {
    session.phase = 'regular';
  } else if (inRange(afterHrs.open, afterHrs.close, hktMins)) {
    session.phase = 'after_hours';
  } else {
    session.phase = 'closed';
  }

  return { session, phase: session.phase };
}

// ── US Holiday helpers ────────────────────────────────────────────────────────
function isUSHoliday(date: Date): { closed: boolean; name?: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dow = date.getDay();

  if (dow === 0) return { closed: true, name: 'Sunday' };
  if (dow === 6) return { closed: true, name: 'Saturday' };

  if (m === 0 && d === 1) return { closed: true, name: "New Year's Day" };

  if (m === 0 && dow === 1 && d >= 15 && d <= 21) {
    const firstMon = new Date(y, 0, 1 + ((8 - new Date(y, 0, 1).getDay()) % 7));
    if (d === firstMon.getDate() + 14) return { closed: true, name: 'Martin Luther King Jr. Day' };
  }

  if (m === 1 && dow === 1 && d >= 15 && d <= 21) {
    const firstMon = new Date(y, 1, 1 + ((8 - new Date(y, 1, 1).getDay()) % 7));
    if (d === firstMon.getDate() + 14) return { closed: true, name: 'Presidents Day' };
  }

  const goodFriday = getGoodFriday(y);
  if (m === goodFriday.getMonth() && d === goodFriday.getDate()) {
    return { closed: true, name: 'Good Friday' };
  }

  if (m === 4 && dow === 1 && d >= 25) return { closed: true, name: 'Memorial Day' };
  if (m === 5 && d === 19) return { closed: true, name: 'Juneteenth' };
  if (m === 6 && d === 4) return { closed: true, name: 'Independence Day' };
  if (m === 8 && dow === 1 && d <= 7) return { closed: true, name: 'Labor Day' };

  if (m === 10) {
    const firstDay = new Date(y, 10, 1).getDay();
    const firstThu = 1 + ((8 - firstDay) % 7);
    if (dow === 4 && d === firstThu + 21) return { closed: true, name: 'Thanksgiving Day' };
  }

  if (m === 11 && d === 25) return { closed: true, name: 'Christmas Day' };

  return { closed: false };
}

function getGoodFriday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31);
  const day = ((h + l - 7 * m2 + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  return new Date(easter.getTime() - 2 * 86400000);
}

function getCountdown(
  phase: Phase,
  hktMins: number,
  holiday: { closed: boolean; name?: string } | null,
  session: MarketSession,
) {
  const minsTo = (target: number): string => {
    let diff = target - hktMins;
    if (diff <= 0) diff += 1440;
    const rh = Math.floor(diff / 60);
    const rm = diff % 60;
    return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
  };

  if (phase === 'closed') {
    if (holiday?.closed) {
      return { label: `${holiday.name} — reopens in`, countdown: minsTo(session.preMkt.open) };
    }
    return { label: 'Pre-market opens in', countdown: minsTo(session.preMkt.open) };
  }
  if (phase === 'pre_market') return { label: 'Regular opens in', countdown: minsTo(session.regular.open) };
  if (phase === 'regular')    return { label: 'Closes in',          countdown: minsTo(session.regular.close) };
  return { label: 'Reopens in',            countdown: minsTo(session.preMkt.open + 1440) };
}

// SVG arc — draw a circular arc from startAngle to endAngle degrees
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

// Convert continuous HKT minutes (can exceed 1440 for next-day windows) to SVG angle
function minsToAngle(mins: number): number {
  const normalised = ((mins % 1440) + 1440) % 1440;
  return (normalised / 1440) * 360;
}

// ── Clock face — hour / minute / second hands (時針分針秒針) ───────────────────
function ClockFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const now  = new Date();
  const hkt  = new Date(now.getTime() + (8 * 3600000) - (now.getTimezoneOffset() * 60000));
  const sec  = hkt.getSeconds();
  const min  = hkt.getMinutes();
  const hrs  = hkt.getHours();

  // 24h clock: hour hand completes one full rotation in 24h
  const secDeg = (sec / 60) * 360;
  const minDeg = ((min + sec / 60) / 60) * 360;
  const hrDeg  = ((hrs + min / 60) / 24) * 360;

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  return (
    <>
      {/* Second hand — red, thin, longest */}
      <line x1={cx} y1={cy}
        x2={cx + (r - 6)  * Math.cos(toRad(secDeg))}
        y2={cy + (r - 6)  * Math.sin(toRad(secDeg))}
        stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
      {/* Minute hand — slate, medium */}
      <line x1={cx} y1={cy}
        x2={cx + (r - 16) * Math.cos(toRad(minDeg))}
        y2={cy + (r - 16) * Math.sin(toRad(minDeg))}
        stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />
      {/* Hour hand — navy, thickest, shortest (52% radius) */}
      <line x1={cx} y1={cy}
        x2={cx + r * 0.52 * Math.cos(toRad(hrDeg))}
        y2={cy + r * 0.52 * Math.sin(toRad(hrDeg))}
        stroke="#0f172a" strokeWidth={3.5} strokeLinecap="round" />
      {/* Centre cap */}
      <circle cx={cx} cy={cy} r={4.5} fill="#0f172a" />
      <circle cx={cx} cy={cy} r={2}   fill="#f8fafc" />
    </>
  );
}

// 24h hour markers
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
          >
            {h === 0 ? '00' : h === 12 ? '12' : h.toString()}
          </text>
        );
      })}
    </>
  );
}

// Phase arc on the clock ring
function PhaseArc({ cx, cy, r, openMins, closeMins, color }: {
  cx: number; cy: number; r: number;
  openMins: number; closeMins: number; color: string;
}) {
  const start = minsToAngle(openMins);
  const end   = minsToAngle(closeMins);
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

const PHASE_META: Record<Phase, { label: string; color: string; badge: string }> = {
  closed:      { label: 'Market Closed',   color: '#94a3b8', badge: 'CLOSED' },
  pre_market:  { label: 'Pre-Market',      color: '#f59e0b', badge: 'PRE-MARKET' },
  regular:     { label: 'Regular Session', color: '#22c55e', badge: 'OPEN' },
  after_hours: { label: 'After Hours',      color: '#a78bfa', badge: 'AFTER-HOURS' },
};

interface MarketClockWidgetProps extends Omit<React.ComponentProps<typeof BaseWidget>, 'title' | 'children'> {}

export function MarketClockWidget(props: MarketClockWidgetProps) {
  const [now, setNow] = useState<Date>(new Date());

  const tick = useCallback(() => setNow(new Date()), []);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const hkt      = new Date(now.getTime() + (8 * 3600000) - (now.getTimezoneOffset() * 60000));
  const hktMins  = hkt.getHours() * 60 + hkt.getMinutes();
  const { session, phase } = getPhaseAndSession();
  const meta     = PHASE_META[phase];
  const holiday  = isUSHoliday(hkt);
  const { label: countdownLabel, countdown } = getCountdown(phase, hktMins, holiday, session);

  const svgSize = 180;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r  = svgSize / 2 - 12;
  const innerR = r - 14;

  const contextText = `${meta.label} (HKT) — ${countdown} until ${phase === 'regular' ? 'close' : 'open'}`;

  return (
    <BaseWidget
      title="US Market Clock"
      contextData={{ label: 'Market Clock', text: contextText }}
      createdByNanobot
      {...props}
    >
      <div className="flex flex-col items-center gap-2 py-1">
        {/* Clock face */}
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="shrink-0">
          {/* Background rings */}
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="currentColor" strokeOpacity={0.06} />
          <circle cx={cx} cy={cy} r={r}      fill="none" stroke="currentColor" strokeOpacity={0.12} />

          {/* Phase arcs */}
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={session.preMkt.open}   closeMins={session.preMkt.close}   color={session.preMkt.color} />
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={session.regular.open}  closeMins={session.regular.close}  color={session.regular.color} />
          <PhaseArc cx={cx} cy={cy} r={innerR}
            openMins={session.afterHrs.open} closeMins={session.afterHrs.close} color={session.afterHrs.color} />

          {/* 24h hour markers */}
          <g color="currentColor">
            <HourMarkers cx={cx} cy={cy} r={r} />
          </g>

          {/* 24h clock hands (時針分針秒針) */}
          <ClockFace cx={cx} cy={cy} r={r} />
        </svg>

        {/* Countdown + Status side by side */}
        <div className="flex items-center gap-6 w-full justify-center">
          {/* Left: countdown */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground text-right">
              {countdownLabel}
            </div>
            <div className="font-mono text-xl font-bold tabular-nums" style={{ color: meta.color }}>
              {countdown}
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Right: badge + HKT time */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide mb-1"
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
            <div className="font-mono text-sm text-muted-foreground">
              HKT {String(hkt.getHours()).padStart(2, '0')}:{String(hkt.getMinutes()).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Phase legend — now with correct hours */}
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          {[
            { label: session.preMkt.label,   color: session.preMkt.color,   range: session.preMkt.range },
            { label: session.regular.label,  color: session.regular.color,  range: session.regular.range },
            { label: session.afterHrs.label,  color: session.afterHrs.color, range: session.afterHrs.range },
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
