import { scaleBand, scaleLinear } from 'd3-scale';
import { useState } from 'react';
import { CHANNELS, type Channel } from '../data/generate';
import type { ChannelBucket } from '../data/metrics';
import { fmtInt } from '../lib/format';
import { useWidth } from '../lib/useSize';
import { Tooltip } from './ChartCard';

interface Props {
  data: ChannelBucket[];
  channels: Channel[]; // visible channels, in stack order (bottom → top)
  label: (b: ChannelBucket) => string; // x-axis label
  title: (b: ChannelBucket) => string; // tooltip heading
  height?: number;
}

const GAP = 2; // surface gap between stacked segments
const R = 4; // rounded data end

/** Column with the top two corners rounded — square at the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function StackedColumns({ data, channels, label, title, height = 260 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(240, width);
  const directLabels = w >= 520; // on narrow screens the legend and the table carry identity
  const M = { top: 12, right: directLabels ? 92 : 8, bottom: 28, left: 34 };
  const innerW = w - M.left - M.right;
  const innerH = height - M.top - M.bottom;

  const x = scaleBand<number>().domain(data.map((_, i) => i)).range([0, innerW]).paddingInner(0.3).paddingOuter(0.1);
  const barW = Math.min(24, x.bandwidth());
  const offset = (x.bandwidth() - barW) / 2;
  const totals = data.map((b) => channels.reduce((s, c) => s + b.counts[c], 0));
  const y = scaleLinear().domain([0, Math.max(4, ...totals)]).nice(4).range([innerH, 0]);
  const ticks = y.ticks(4);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))));

  const slot = (c: Channel) => CHANNELS.find((ch) => ch.id === c)!.slot;
  const stacks = data.map((b) => {
    let acc = 0;
    const segs = channels.map((c) => {
      const s = { channel: c, y0: acc, y1: acc + b.counts[c] };
      acc += b.counts[c];
      return s;
    }).filter((s) => s.y1 > s.y0);
    return segs;
  });

  // Direct labels next to the last column, only where a segment is tall enough and labels do not collide.
  const lastIdx = data.length - 1;
  const labels: { channel: Channel; y: number }[] = [];
  if (directLabels && lastIdx >= 0) {
    let prevY = Infinity;
    for (const s of stacks[lastIdx]) {
      const mid = (y(s.y0) + y(s.y1)) / 2;
      if (y(s.y0) - y(s.y1) >= 12 && prevY - mid >= 13) {
        labels.push({ channel: s.channel, y: mid });
        prevY = mid;
      }
    }
  }

  const hovered = hover !== null ? data[hover] : null;
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Leads by channel, stacked columns">
        <g transform={`translate(${M.left},${M.top})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line className={t === 0 ? 'baseline' : 'grid-line'} x1={0} x2={innerW} />
              <text x={-8} dy="0.32em" textAnchor="end">{fmtInt(t)}</text>
            </g>
          ))}
          {data.map((b, i) => ((lastIdx - i) % every === 0 ? (
            <text key={b.start} x={(x(i) ?? 0) + x.bandwidth() / 2} y={innerH + 18} textAnchor="middle">{label(b)}</text>
          ) : null))}

          {stacks.map((segs, i) => (
            <g key={data[i].start} opacity={hover === null || hover === i ? 1 : 0.45}>
              {segs.map((s, k) => {
                const top = y(s.y1);
                const bottom = y(s.y0) - (k === 0 ? 0 : GAP);
                const h = Math.max(0, bottom - top);
                const bx = (x(i) ?? 0) + offset;
                return k === segs.length - 1
                  ? <path key={s.channel} className={`s-${slot(s.channel)}`} d={topRounded(bx, top, barW, h, R)} />
                  : <rect key={s.channel} className={`s-${slot(s.channel)}`} x={bx} y={top} width={barW} height={h} />;
              })}
            </g>
          ))}

          {labels.map((l) => (
            <g key={l.channel} transform={`translate(${(x(lastIdx) ?? 0) + offset + barW + 8},${l.y})`}>
              <text className="label" dy="0.32em">{CHANNELS.find((c) => c.id === l.channel)!.label}</text>
            </g>
          ))}

          {/* hit targets: the whole column band, taller and wider than the painted bar */}
          {data.map((b, i) => (
            <rect key={b.start} x={x(i)} width={x.bandwidth()} y={0} height={innerH} fill="transparent"
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </g>
      </svg>
      {hovered && hover !== null && (
        <Tooltip x={M.left + (x(hover) ?? 0) + x.bandwidth() / 2} y={M.top + y(totals[hover])}>
          <div className="tip-title">{title(hovered)} · {fmtInt(totals[hover])} leads</div>
          {[...channels].reverse().map((c) => (
            <div className="tip-row" key={c}>
              <i className={`key-line bg-${slot(c)}`} />
              <b>{fmtInt(hovered.counts[c])}</b><span>{CHANNELS.find((ch) => ch.id === c)!.label}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}
