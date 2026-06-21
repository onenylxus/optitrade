'use client';

import { useEffect, useState, useCallback } from 'react';
import { BaseWidget } from './base-widget';

// ── Market phases (HKT 24h format, mapped from ET) ──────────────────────────
// HKT = UTC+8; ET = UTC-5/4. ET offset from HKT is -12 or -13h (DST).
// Market hours in HKT (wraps across midnight):
//   Pre-market:  21:30 – 00:00 HKT (prev day ET 04:00–09:30)
//   Regular:     00:00 – 04:00 HKT (same day ET 09:30–16:00)
//   After-hours: 04:00 – 08:00 HKT (same day ET 16:00–20:00)
const PRE_MARKET  = { open: 21 * 60 + 30, close: 24 * 60 };
const REGULAR     = { open: 24 * 60,      close: 28 * 60 };
const AFTER_HOURS = { open: 28 * 60,       close: 32 * 60 };

type Phase = 'closed' | 'pre_market' | 'regular' | 'after_hours';

function normaliseMin(m: number): number {
  const d = m % (24 * 60);
  return d < 0 ? d + 24 * 60 : d;
}

function getPhase(minutesHKT: number): Phase {
  const m = normaliseMin(minutesHKT);
  if (m >= PRE_MARKET.open  && m < PRE_MARKET.close)  return 'pre_market';
  if (m >= REGULAR.open     && m < REGULAR.close)     return 'regular';
  if (m >= AFTER_HOURS.open && m < AFTER_HOURS.close) return 'after_hours';
  return 'closed';
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

function getCountdown(phase: Phase, minutesHKT: number, holiday: { closed: boolean; name?: string } | null) {
  if (phase === 'closed') {
    if (holiday?.closed) {
      const rem = (24 * 60 - minutesHKT) + PRE_MARKET.open;
      const rh = Math.floor(rem / 60);
      const rm = rem % 60;
      return { label: `${holiday.name} — reopens in`, countdown: `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}` };
    }
    const rem = PRE_MARKET.open - minutesHKT;
    const rh = Math.floor(rem / 60);
    const rm = rem % 60;
    return { label: 'Pre-market opens in', countdown: `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}` };
  }
  if (phase === 'pre_market') {
    const rem = REGULAR.open - minutesHKT;
    const rh = Math.floor(rem / 60);
    const rm = rem % 60;
    return { label: 'Regular opens in', countdown: `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}` };
  }
  if (phase === 'regular') {
    const rem = minutesHKT < 24 * 60
      ? (24 * 60 - minutesHKT) + REGULAR.close
      : REGULAR.close - minutesHKT;
    const rh = Math.floor(rem / 60);
    const rm = rem % 60;
    return { label: 'Closes in', countdown: `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}` };
  }
  const rem = (24 * 60 - minutesHKT) + PRE_MARKET.open;
  const rh = Math.floor(rem / 60);
  const rm = rem % 60;
  return { label: 'Reopens in', countdown: `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}` };
}

// SVG arc helper
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const large = ((endAngle - startAngle) % 360 + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function minutesToAngle(minutes: number) {
  return ((minutes % (24 * 60) + 24 * 60) % (24 * 60)) / (24 * 60) * 360;
}

// 24h clock face hour markers
function HourMarkers({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <>
      {hours.map((h) => {
        const angle = ((h / 24) * 360 - 90) * (Math.PI / 180);
        const isMajor = h % 6 === 0;
        const inner = r - (isMajor ? 8 : 5);
        const outer = r;
        return (
          <line
            key={h}
            x1={cx + inner * Math.cos(angle)}
            y1={cy + inner * Math.sin(angle)}
            x2={cx + outer * Math.cos(angle)}
            y2={cy + outer * Math.sin(angle)}
            stroke="currentColor"
            strokeWidth={isMajor ? 2 : 1}
            strokeOpacity={isMajor ? 0.6 : 0.3}
          />
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const label = h === 0 ? '00' : h === 12 ? '12' : h.toString();
        const angle = ((h / 24) * 360 - 90) * (Math.PI / 180);
        const labelR = r - 18;
        return (
          <text
            key={h}
            x={cx + labelR * Math.cos(angle)}
            y={cy + labelR * Math.sin(angle)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {label}
          </text>
        );
      })}
    </>
  );
}

// Phase arc
function PhaseArc({
  cx, cy, r, openMin, closeMin, color,
}: {
  cx: number; cy: number; r: number;
  openMin: number; closeMin: number; color: string;
}) {
  const start = minutesToAngle(openMin);
  let end = minutesToAngle(closeMin);
  let large = (closeMin - openMin) / (24 * 60) > 0.5 ? 1 : 0;
  if (closeMin < openMin) large = 1;

  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(start));
  const y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(end));
  const y2 = cy + r * Math.sin(toRad(end));

  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  return (
    <>
      <path d={d} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.9} />
      <path d={d} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.3}
        style={{ filter: `blur(4px)` }} />
    </>
  );
}

// ── Analogue clock face — hour / minute / second hands (時針分針秒針) ─────────
function ClockFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const now = new Date();
  const sec = now.getSeconds();
  const min = now.getMinutes();
  const hrs = now.getHours();

  const secDeg = (sec / 60) * 360;
  const minDeg = ((min + sec / 60) / 60) * 360;
  const hrDeg  = ((hrs + min / 60) / 24) * 360;

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const sRad = toRad(secDeg); const sLen = r - 6;
  const mRad = toRad(minDeg); const mLen = r - 14;
  const hRad = toRad(hrDeg);  const hLen = r * 0.52;

  return (
    <>
      <line x1={cx} y1={cy} x2={cx + sLen * Math.cos(sRad)} y2={cy + sLen * Math.sin(sRad)}
        stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + mLen * Math.cos(mRad)} y2={cy + mLen * Math.sin(mRad)}
        stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + hLen * Math.cos(hRad)} y2={cy + hLen * Math.sin(hRad)}
        stroke="#0f172a" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4.5} fill="#0f172a" />
      <circle cx={cx} cy={cy} r={2} fill="#f8fafc" />
    </>
  );
}

const PHASE_META: Record<Phase, { label: string; color: string; badge: string }> = {
  closed:       { label: 'Market Closed',    color: '#94a3b8', badge: 'CLOSED' },
  pre_market:   { label: 'Pre-Market',       color: '#f59e0b', badge: 'PRE-MARKET' },
  regular:      { label: 'Regular Session',  color: '#22c55e', badge: 'OPEN' },
  after_hours:  { label: 'After Hours',       color: '#a78bfa', badge: 'AFTER-HOURS' },
};

interface MarketClockWidgetProps extends Omit<React.ComponentProps<typeof BaseWidget>, 'title' | 'children'> {}

export function MarketClockWidget(props: MarketClockWidgetProps) {
  const [now, setNow] = useState<Date>(new Date());

  const tick = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // HKT = UTC+8, no DST
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const hk  = new Date(utc + 8 * 3600000);
  const hkHours   = hk.getHours();
  const hkMinutes = hk.getMinutes();
  const minutesHKT = hkHours * 60 + hkMinutes;
  const phase = getPhase(minutesHKT);
  const meta  = PHASE_META[phase];

  const svgSize = 180;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r  = svgSize / 2 - 12;
  const innerR = r - 10;

  const todayHoliday = isUSHoliday(hk);
  const { label: countdownLabel, countdown } = getCountdown(phase, minutesHKT, todayHoliday);
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
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="shrink-0"
        >
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="currentColor" strokeOpacity={0.08} />
          <circle cx={cx} cy={cy} r={r}     fill="none" stroke="currentColor" strokeOpacity={0.12} />

          {/* Phase arcs */}
          <PhaseArc cx={cx} cy={cy} r={innerR} openMin={PRE_MARKET.open}  closeMin={PRE_MARKET.close}  color="#f59e0b" />
          <PhaseArc cx={cx} cy={cy} r={innerR} openMin={REGULAR.open}    closeMin={REGULAR.close}    color="#22c55e" />
          <PhaseArc cx={cx} cy={cy} r={innerR} openMin={AFTER_HOURS.open} closeMin={AFTER_HOURS.close} color="#a78bfa" />

          {/* Hour markers */}
          <g color="currentColor">
            <HourMarkers cx={cx} cy={cy} r={r} />
          </g>

          {/* 24h clock hands (時針分針秒針) */}
          <ClockFace cx={cx} cy={cy} r={r} />
        </svg>

        {/* Phase badge + HKT time — side by side */}
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

          {/* Right: status badge + HKT time */}
          <div className="flex flex-col items-center">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ backgroundColor: meta.color + '22', color: meta.color }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: meta.color,
                  boxShadow: phase !== 'closed' ? `0 0 4px ${meta.color}` : undefined,
                  animation: phase !== 'closed' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}
              />
              {meta.badge}
            </div>
            <div className="font-mono text-sm text-muted-foreground">
              HKT {String(hkHours).padStart(2, '0')}:{String(hkMinutes).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Phase legend */}
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          {[
            { label: 'Pre-Market',  color: '#f59e0b', range: '21:30 – 00:00' },
            { label: 'Regular',     color: '#22c55e', range: '00:00 – 04:00' },
            { label: 'After-Hours', color: '#a78bfa', range: '04:00 – 08:00' },
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
