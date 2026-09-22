import { scaleLinear } from 'd3-scale';
import { useState } from 'react';
import type { FunnelStep } from '../data/metrics';
import { fmtInt, fmtPct } from '../lib/format';
import { useWidth } from '../lib/useSize';
import { Tooltip } from './ChartCard';

const ROW = 44;
const BAR = 20; // ≤ 24px thick
const LABEL_W = 84;

/** Stages are ordered, so the bars use one hue stepping darker — an ordinal ramp, not five categories. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(240, width);
  const valueW = w < 420 ? 64 : 150; // room for the value label outside the bar end
  const innerW = w - LABEL_W - valueW;
  const x = scaleLinear().domain([0, Math.max(1, steps[0]?.count ?? 1)]).range([0, innerW]);
  const height = steps.length * ROW;

  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={`Funnel: ${steps.map((s) => `${s.stage} ${s.count}`).join(', ')}`}>
        {steps.map((s, i) => {
          const len = Math.max(2, x(s.count));
          const y0 = i * ROW + (ROW - BAR) / 2;
          const r = Math.min(4, len / 2);
          return (
            <g key={s.stage} opacity={hover === null || hover === i ? 1 : 0.5}>
              <text className="label" x={0} y={y0 + BAR / 2} dy="0.32em">{s.stage}</text>
              <path
                style={{ fill: `var(--funnel-${i + 1})` }}
                d={`M${LABEL_W},${y0}H${LABEL_W + len - r}Q${LABEL_W + len},${y0} ${LABEL_W + len},${y0 + r}`
                  + `V${y0 + BAR - r}Q${LABEL_W + len},${y0 + BAR} ${LABEL_W + len - r},${y0 + BAR}H${LABEL_W}Z`}
              />
              <text x={LABEL_W + len + 8} y={y0 + BAR / 2} dy="0.32em">
                <tspan className="label-strong">{fmtInt(s.count)}</tspan>
                {s.ofPrevious !== null && valueW > 100 && <tspan dx={6}>{fmtPct(s.ofPrevious)} of previous</tspan>}
              </text>
              <rect x={0} y={i * ROW} width={w} height={ROW} fill="transparent"
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={LABEL_W + Math.max(2, x(steps[hover].count)) / 2} y={hover * ROW + (ROW - BAR) / 2}>
          <div className="tip-title">{steps[hover].stage}</div>
          <div className="tip-row"><b>{fmtInt(steps[hover].count)}</b><span>leads</span></div>
          <div className="tip-row"><b>{fmtPct(steps[hover].ofTotal)}</b><span>of all leads</span></div>
          {steps[hover].ofPrevious !== null && (
            <div className="tip-row"><b>{fmtPct(steps[hover].ofPrevious!)}</b><span>of the previous stage</span></div>
          )}
        </Tooltip>
      )}
    </div>
  );
}
