import { useMemo, useState } from 'react';
import { ChartCard } from './components/ChartCard';
import { Funnel } from './components/Funnel';
import { Heatmap, hourRange, WEEKDAYS } from './components/Heatmap';
import { LeadsTable } from './components/LeadsTable';
import { LineChart } from './components/LineChart';
import { StackedColumns } from './components/StackedColumns';
import { StatTile } from './components/StatTile';
import { CHANNELS, type Channel, generateLeads, startOfDay } from './data/generate';
import {
  automationImpact, buckets, byChannel, daily, DAY, delta, funnel, heatmap, inRange, kpis, median, type Range,
  rangesFor, rolling,
} from './data/metrics';
import { fmtDay, fmtInt, fmtMinutes, fmtPct, fmtSigned, fmtUsdCompact, fmtWeekday } from './lib/format';
import { type ThemeChoice, useTheme } from './lib/theme';

const RANGES = [7, 30, 90] as const;
type Days = (typeof RANGES)[number];

export default function App() {
  const [now] = useState(() => Date.now());
  const leads = useMemo(() => generateLeads(now), [now]);
  const [days, setDays] = useState<Days>(90); // 90 days shows the whole before/after story
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [theme, setTheme] = useTheme();

  const view = useMemo(() => {
    const { current, previous } = rangesFor(days, now);
    const cur = inRange(leads, current, channel);
    const prev = inRange(leads, previous, channel);
    const bookedShare = (g: typeof cur) => (g.length ? g.filter((l) => l.reached >= 3).length / g.length : null);

    // Daily counts are noisy over 30+ days, so the chart shows a 7-day average through yesterday
    // (today is not over, it would drag the average down). The 7-day view shows raw days including today.
    const smoothed = days >= 30;
    const chartEnd = smoothed ? startOfDay(now) : current.end;
    const curR: Range = { start: current.start, end: chartEnd };
    const prevR: Range = { start: previous.start, end: previous.start + (chartEnd - current.start) };
    const dailyOf = (r: Range) => daily(inRange(leads, r, channel), r);
    const avgOf = (r: Range) => rolling(dailyOf({ start: r.start - 6 * DAY, end: r.end }), 7).slice(6);
    const paid = cur.filter((l) => l.reached >= 4);
    return {
      current,
      cur,
      k: kpis(cur),
      kp: kpis(prev),
      spark: {
        leads: buckets(cur, current, 12, (g) => g.length),
        response: buckets(cur, current, 12, (g) => median(g.flatMap((l) => (l.responseMin === null ? [] : [l.responseMin])))),
        rate: buckets(cur, current, 12, bookedShare),
        revenue: buckets(cur, current, 12, (g) => g.filter((l) => l.reached >= 3).reduce((s, l) => s + l.value, 0)),
      },
      smoothed,
      rawCur: dailyOf(curR),
      rawPrev: dailyOf(prevR),
      plotCur: smoothed ? avgOf(curR) : dailyOf(curR),
      plotPrev: smoothed ? avgOf(prevR) : dailyOf(prevR),
      paidShare: cur.length ? paid.length / cur.length : null,
      avgPaid: paid.length ? paid.reduce((s, l) => s + l.value, 0) / paid.length : null,
      byChannel: byChannel(cur, current, days === 90 ? 7 : 1),
      funnel: funnel(cur),
      heat: heatmap(cur),
    };
  }, [leads, days, channel, now]);

  const impact = useMemo(() => automationImpact(leads, now), [leads, now]);
  const { k, kp } = view;
  const vs = `vs previous ${days} days`;
  const visibleChannels = channel === 'all' ? CHANNELS.map((c) => c.id) : [channel];
  const weekly = days === 90;
  const rateChange = k.bookedRate !== null && kp.bookedRate !== null ? (k.bookedRate - kp.bookedRate) * 100 : null;
  const pctChange = (a: number | null, b: number | null) => {
    const d = delta(a, b);
    return { change: d, changeText: d === null ? '—' : fmtSigned(d * 100) };
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 14 7 8l3 3 6-7" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <h1>Leadboard <span className="badge">DEMO DATA</span></h1>
            <p>Inbound leads · Brightwork Renovations</p>
          </div>
        </div>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="Color theme">
            {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="filters" role="toolbar" aria-label="Filters">
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>Last {d} days</button>
          ))}
        </div>
        <select className="select" value={channel} aria-label="Channel"
          onChange={(e) => setChannel(e.target.value as Channel | 'all')}>
          <option value="all">All channels</option>
          {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="note">Compared with the {days} days before</span>
      </div>

      {impact.before.medianResponse !== null && impact.after.medianResponse !== null && (
        <div className="callout" role="note">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M10 1 3 10h5l-1 7 7-9H9l1-7Z"
            fill="currentColor" /></svg>
          <div>
            Lead intake was automated on <b>{fmtDay(impact.launch)}</b>: website form → Google Sheets → Telegram alert
            + instant auto-reply. Median first reply went from <b>{fmtMinutes(impact.before.medianResponse)}</b> to{' '}
            <b>{fmtMinutes(impact.after.medianResponse)}</b>, lead → booked from{' '}
            <b>{fmtPct(impact.before.bookedRate ?? 0)}</b> to <b>{fmtPct(impact.after.bookedRate ?? 0)}</b>.
          </div>
        </div>
      )}

      <section className="kpis" aria-label="Key numbers">
        <StatTile label="New leads" value={fmtInt(k.leads)} {...pctChange(k.leads, kp.leads)} goodWhenUp
          comparison={vs} spark={view.spark.leads} />
        <StatTile label="Median first reply" value={fmtMinutes(k.medianResponse)}
          {...pctChange(k.medianResponse, kp.medianResponse)} goodWhenUp={false} comparison={vs}
          spark={view.spark.response} />
        <StatTile label="Lead → booked" value={k.bookedRate === null ? '—' : fmtPct(k.bookedRate, 1)} change={rateChange}
          changeText={rateChange === null ? '—' : fmtSigned(rateChange, 1, ' pp')} goodWhenUp comparison={vs}
          spark={view.spark.rate} />
        <StatTile label="Booked revenue" value={fmtUsdCompact(k.bookedRevenue)} {...pctChange(k.bookedRevenue, kp.bookedRevenue)}
          goodWhenUp comparison={vs} spark={view.spark.revenue} />
      </section>

      <div className="grid">
        <ChartCard
          className="wide"
          title="Leads per day"
          subtitle={view.smoothed
            ? `7-day rolling average through ${fmtDay(startOfDay(now) - DAY)} · ${fmtInt(k.leads)} leads in ${days} days`
            : `${fmtInt(k.leads)} leads in the last ${days} days, today included`}
          legend={<>
            <span><i className="key-line" style={{ background: 'var(--accent)' }} />This period</span>
            <span><i className="key-line" style={{ background: 'var(--deemph)' }} />Previous {days} days</span>
          </>}
          table={{
            columns: ['Day', 'Leads', '7-day avg', 'Same day, previous period', 'Leads', '7-day avg'],
            numeric: [false, true, true, false, true, true],
            rows: view.rawCur.map((d, i) => [fmtWeekday(d.date), d.count, view.plotCur[i].count.toFixed(1),
              fmtWeekday(view.rawPrev[i].date), view.rawPrev[i].count, view.plotPrev[i].count.toFixed(1)]),
          }}
        >
          <LineChart current={view.plotCur} previous={view.plotPrev} rawCurrent={view.rawCur} rawPrevious={view.rawPrev}
            smoothed={view.smoothed} partialLast={!view.smoothed}
            annotation={{ date: impact.launch, label: 'Automation live' }} />
        </ChartCard>

        <ChartCard
          title="Leads by channel"
          subtitle={weekly ? 'Per week' : 'Per day'}
          legend={CHANNELS.filter((c) => visibleChannels.includes(c.id)).map((c) => (
            <span key={c.id}><i className={`key-rect bg-${c.slot}`} />{c.label}</span>
          ))}
          table={{
            columns: [weekly ? 'Week of' : 'Day', ...CHANNELS.filter((c) => visibleChannels.includes(c.id)).map((c) => c.label),
              'Total'],
            numeric: [false, ...visibleChannels.map(() => true), true],
            rows: view.byChannel.map((b) => [fmtDay(b.start), ...visibleChannels.map((c) => b.counts[c]),
              visibleChannels.reduce((s, c) => s + b.counts[c], 0)]),
          }}
        >
          <StackedColumns data={view.byChannel} channels={visibleChannels}
            label={(b) => fmtDay(b.start)}
            title={(b) => (weekly ? `Week of ${fmtDay(b.start)}` : fmtWeekday(b.start))} />
        </ChartCard>

        <ChartCard
          title="Pipeline"
          subtitle="How far leads from this period got"
          table={{
            columns: ['Stage', 'Leads', 'Of all leads', 'Of previous stage'],
            numeric: [false, true, true, true],
            rows: view.funnel.map((s) => [s.stage, s.count, fmtPct(s.ofTotal),
              s.ofPrevious === null ? '—' : fmtPct(s.ofPrevious)]),
          }}
        >
          <Funnel steps={view.funnel} />
          <div className="mini-stats">
            <div>
              <b>{view.paidShare === null ? '—' : fmtPct(view.paidShare, 1)}</b>
              <span>of leads became paying clients</span>
            </div>
            <div>
              <b>{view.avgPaid === null ? '—' : fmtUsdCompact(view.avgPaid)}</b>
              <span>average paid job</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          className="wide"
          title="When leads come in"
          subtitle="Weekday × hour of day, local time — staff the phone for the dark cells"
          table={{
            columns: ['Weekday', 'Busiest hour', 'Leads then', 'Leads that day'],
            numeric: [false, false, true, true],
            rows: view.heat.map((row, r) => {
              const top = row.indexOf(Math.max(...row));
              return [WEEKDAYS[r], hourRange(top), row[top], row.reduce((s, v) => s + v, 0)];
            }),
          }}
        >
          <Heatmap grid={view.heat} />
        </ChartCard>
      </div>

      <LeadsTable leads={view.cur} />

      <footer className="foot">
        <span>
          React + TypeScript + D3 scales, no chart library. 190 days of leads are generated with a seeded PRNG
          (<code>src/data/generate.ts</code>) — swap it for your API.
        </span>
        <a href="https://github.com/nondeadted-kwork/leadboard">Source on GitHub</a>
      </footer>
    </div>
  );
}
