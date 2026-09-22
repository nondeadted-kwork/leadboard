import { useState } from 'react';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/useSize';
import { Tooltip } from './ChartCard';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
const GAP = 2;
const LEFT = 36;
const BINS = 6;

export function hourRange(h: number): string {
  const f = (x: number) => `${String(x % 24).padStart(2, '0')}:00`;
  return `${f(h)}–${f(h + 1)}`;
}

/** Bin 1..6 for a count, 0 for empty cells. Linear bins over the max keep the legend readable. */
export function binOf(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(BINS, Math.max(1, Math.ceil((value / max) * BINS)));
}

export function Heatmap({ grid }: { grid: number[][] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<[number, number] | null>(null);
  const w = Math.max(240, width);
  const cellW = (w - LEFT) / 24;
  const cellH = Math.min(26, Math.max(16, cellW));
  const height = 7 * cellH + 26;
  const max = Math.max(0, ...grid.flat());
  const total = grid.flat().reduce((s, v) => s + v, 0);

  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Leads by weekday and hour of day">
        {WEEKDAYS.map((d, r) => (
          <text key={d} x={0} y={r * cellH + cellH / 2} dy="0.32em">{d}</text>
        ))}
        {HOUR_LABELS.map((h, i) => (
          <text key={h} x={LEFT + i * 3 * cellW} y={7 * cellH + 16}>{h}</text>
        ))}
        {grid.map((row, r) => row.map((v, c) => {
          const active = hover !== null && hover[0] === r && hover[1] === c;
          return (
            <rect key={`${r}-${c}`} x={LEFT + c * cellW} y={r * cellH} width={Math.max(1, cellW - GAP)}
              height={cellH - GAP} rx={2} style={{ fill: `var(--heat-${binOf(v, max)})` }}
              stroke={active ? 'var(--ink)' : 'none'} strokeWidth={active ? 1.5 : 0}
              onPointerEnter={() => setHover([r, c])} onPointerLeave={() => setHover(null)} />
          );
        }))}
      </svg>
      <div className="legend" style={{ marginTop: 8, gap: 6 }} aria-hidden="true">
        <span>Fewer</span>
        {Array.from({ length: BINS }, (_, i) => (
          <i key={i} className="key-rect" style={{ background: `var(--heat-${i + 1})`, width: 18 }} />
        ))}
        <span>More · max {fmtInt(max)} leads per hour slot</span>
      </div>
      {hover !== null && (
        <Tooltip x={LEFT + hover[1] * cellW + cellW / 2} y={hover[0] * cellH}>
          <div className="tip-title">{WEEKDAYS[hover[0]]} · {hourRange(hover[1])}</div>
          <div className="tip-row"><b>{fmtInt(grid[hover[0]][hover[1]])}</b><span>leads</span></div>
          <div className="tip-row">
            <b>{total ? fmtPct(grid[hover[0]][hover[1]] / total, 1) : '—'}</b><span>of the period</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
