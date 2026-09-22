import { line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { useWidth } from '../lib/useSize';

interface StatTileProps {
  label: string;
  value: string;
  change: number | null; // signed, in the unit of `changeText`
  changeText: string; // "+12%", "−3 pp"
  goodWhenUp: boolean;
  comparison: string; // "vs previous 30 days"
  spark: (number | null)[];
}

export function StatTile({ label, value, change, changeText, goodWhenUp, comparison, spark }: StatTileProps) {
  const tone = change === null || Math.abs(change) < 1e-9 ? 'flat' : (change > 0) === goodWhenUp ? 'good' : 'bad';
  const arrow = change === null || tone === 'flat' ? '' : change > 0 ? '▲' : '▼';
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-delta">
        <span className={`d ${tone}`}>
          {arrow && <span aria-hidden="true">{arrow} </span>}
          {change === null ? '—' : changeText}
        </span>
        <span className="vs">{comparison}</span>
      </div>
      <Sparkline values={spark} label={`${label} trend`} />
    </div>
  );
}

/** 12 points in the de-emphasis gray; the latest point in the accent. */
function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(200);
  const h = 32;
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <div ref={ref} style={{ height: h + 8 }} />;
  const ys = pts.map((p) => p[1]);
  const x = scaleLinear().domain([0, values.length - 1]).range([4, width - 4]);
  const y = scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([h - 4, 4]);
  if (Math.min(...ys) === Math.max(...ys)) y.domain([ys[0] - 1, ys[0] + 1]);
  const d = line<readonly [number, number]>().x((p) => x(p[0])).y((p) => y(p[1]))(pts) ?? '';
  const last = pts[pts.length - 1];
  return (
    <div ref={ref}>
      <svg className="spark" width={width} height={h} role="img" aria-label={label}>
        <path d={d} fill="none" stroke="var(--deemph)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last[0])} cy={y(last[1])} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
      </svg>
    </div>
  );
}
