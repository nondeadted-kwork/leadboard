import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { type PointerEvent, useState } from 'react';
import type { DayPoint } from '../data/metrics';
import { fmtDay, fmtInt, fmtWeekday } from '../lib/format';
import { useWidth } from '../lib/useSize';
import { Tooltip } from './ChartCard';

interface LineChartProps {
  current: DayPoint[]; // what is drawn: daily counts or a 7-day average
  previous: DayPoint[]; // same length, aligned by position
  rawCurrent: DayPoint[]; // daily counts, for the tooltip
  rawPrevious: DayPoint[];
  smoothed: boolean;
  partialLast: boolean; // the last point is today and the day is not over
  annotation?: { date: number; label: string } | null;
  height?: number;
}

const M = { top: 22, right: 64, bottom: 28, left: 34 };

/** This period in the accent, the previous period in gray for context (emphasis, not two categories). */
export function LineChart({ current, previous, rawCurrent, rawPrevious, smoothed, partialLast, annotation,
  height = 260 }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const w = Math.max(240, width);
  const innerW = w - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const n = current.length;
  const fmt = (v: number) => (smoothed ? v.toFixed(1) : fmtInt(v));

  const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([0, innerW]);
  const maxY = Math.max(4, ...current.map((d) => d.count), ...previous.map((d) => d.count));
  const y = scaleLinear().domain([0, maxY]).nice(4).range([innerH, 0]);
  const ticks = y.ticks(4);
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))));
  const xTicks = current.map((_, i) => i).filter((i) => (n - 1 - i) % step === 0);

  const toLine = line<DayPoint>().x((_, i) => x(i)).y((d) => y(d.count)).curve(curveMonotoneX);
  const toArea = area<DayPoint>().x((_, i) => x(i)).y0(innerH).y1((d) => y(d.count)).curve(curveMonotoneX);

  const annIndex = annotation && n ? Math.round((annotation.date - current[0].date) / 86_400_000) : -1;
  const showAnn = annIndex >= 0 && annIndex < n;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(x.invert(e.clientX - box.left));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  if (!n) return <div className="chart" ref={ref} style={{ height }} />;
  const last = current[n - 1];
  const soFar = (i: number) => partialLast && i === n - 1;
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={`Leads per day${smoothed ? ', 7-day average' : ''}. Latest: ${fmt(last.count)}.`}>
        <g transform={`translate(${M.left},${M.top})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line className={t === 0 ? 'baseline' : 'grid-line'} x1={0} x2={innerW} />
              <text x={-8} dy="0.32em" textAnchor="end">{fmtInt(t)}</text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} x={x(i)} y={innerH + 18} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {fmtDay(current[i].date)}
            </text>
          ))}

          {showAnn && (
            <g transform={`translate(${x(annIndex)},0)`}>
              <line className="annotation" y1={-6} y2={innerH} />
              <text className="label" x={6} y={-8} style={{ fontSize: 11.5 }}>{annotation!.label}</text>
            </g>
          )}

          <path d={toArea(current) ?? ''} fill="var(--accent)" fillOpacity={0.1} />
          <path d={toLine(previous) ?? ''} fill="none" stroke="var(--deemph)" strokeWidth={2} strokeLinejoin="round"
            strokeLinecap="round" />
          <path d={toLine(current) ?? ''} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round"
            strokeLinecap="round" />

          {/* the value at the end of the line */}
          <circle cx={x(n - 1)} cy={y(last.count)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          <text x={x(n - 1) + 8} y={y(last.count)} dy="0.32em">
            <tspan className="label-strong">{fmt(last.count)}</tspan>
            {soFar(n - 1) && <tspan dx={4}>so far</tspan>}
          </text>

          {hover !== null && (
            <g pointerEvents="none">
              <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} />
              <circle cx={x(hover)} cy={y(previous[hover].count)} r={4} fill="var(--deemph)" stroke="var(--surface)"
                strokeWidth={2} />
              <circle cx={x(hover)} cy={y(current[hover].count)} r={4} fill="var(--accent)" stroke="var(--surface)"
                strokeWidth={2} />
            </g>
          )}
          <rect width={innerW} height={innerH + M.bottom} fill="transparent" onPointerMove={onMove}
            onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }} />
        </g>
      </svg>
      {hover !== null && (
        <Tooltip x={M.left + x(hover)} y={M.top + Math.min(y(current[hover].count), y(previous[hover].count))}>
          <div className="tip-title">{fmtWeekday(current[hover].date)}{soFar(hover) ? ' · today, so far' : ''}</div>
          <div className="tip-row">
            <i className="key-line" style={{ background: 'var(--accent)' }} />
            <b>{fmt(current[hover].count)}</b>
            <span>{smoothed ? `7-day avg · ${fmtInt(rawCurrent[hover].count)} that day` : 'leads'}</span>
          </div>
          <div className="tip-row">
            <i className="key-line" style={{ background: 'var(--deemph)' }} />
            <b>{fmt(previous[hover].count)}</b>
            <span>
              {smoothed ? `avg on ${fmtDay(previous[hover].date)} · ${fmtInt(rawPrevious[hover].count)} that day`
                : `on ${fmtDay(previous[hover].date)}`}
            </span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
