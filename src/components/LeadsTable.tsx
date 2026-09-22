import { useMemo, useState } from 'react';
import { CHANNELS, type Lead } from '../data/generate';
import { stageLabel } from '../data/metrics';
import { fmtDateTime, fmtMinutes, fmtUsd } from '../lib/format';

type SortKey = 'createdAt' | 'value' | 'responseMin' | 'name';
const PAGE = 10;
const STAGE_FILTERS = ['All', 'New', 'Contacted', 'Qualified', 'Booked', 'Paid', 'Lost'];
const ICON: Record<string, string> = { New: '●', Contacted: '◐', Qualified: '◑', Booked: '✓', Paid: '✓', Lost: '✕' };

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('All');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((l) =>
      (stage === 'All' || stageLabel(l) === stage)
      && (!q || l.name.toLowerCase().includes(q) || l.service.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)));
    const { key, dir } = sort;
    return filtered.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (x === null) return 1; // not contacted yet → always last
      if (y === null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * dir;
    });
  }, [leads, query, stage, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE);

  const sortBy = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'name' ? 1 : -1 }));
    setPage(0);
  };
  const aria = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined);
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');

  const exportCsv = () => {
    const header = ['id', 'name', 'channel', 'service', 'value_usd', 'stage', 'first_reply_min', 'received'];
    const lines = rows.map((l) => [l.id, l.name, l.channel, l.service, l.value, stageLabel(l), l.responseMin ?? '',
      new Date(l.createdAt).toISOString()].map(csvEscape).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'leads.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card leads" aria-labelledby="leads-title">
      <header className="chart-head">
        <div>
          <h2 id="leads-title">Recent leads</h2>
          <p>{rows.length.toLocaleString('en-US')} leads in the selected period</p>
        </div>
      </header>
      <div className="leads-tools">
        <input className="search" type="search" placeholder="Search name, service, ID" value={query} aria-label="Search leads"
          onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        <select className="select" value={stage} aria-label="Stage"
          onChange={(e) => { setStage(e.target.value); setPage(0); }}>
          {STAGE_FILTERS.map((s) => <option key={s} value={s}>{s === 'All' ? 'All stages' : s}</option>)}
        </select>
        <span className="spacer" />
        <button type="button" className="ghost-btn" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-sort={aria('name')}><button type="button" onClick={() => sortBy('name')}>Lead{arrow('name')}</button></th>
              <th className="col-opt">Channel</th>
              <th className="col-opt">Service</th>
              <th className="r col-opt" aria-sort={aria('value')}>
                <button type="button" onClick={() => sortBy('value')}>Est. value{arrow('value')}</button>
              </th>
              <th>Stage</th>
              <th className="r col-opt" aria-sort={aria('responseMin')}>
                <button type="button" onClick={() => sortBy('responseMin')}>First reply{arrow('responseMin')}</button>
              </th>
              <th className="r" aria-sort={aria('createdAt')}>
                <button type="button" onClick={() => sortBy('createdAt')}>Received{arrow('createdAt')}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => {
              const ch = CHANNELS.find((c) => c.id === l.channel)!;
              const st = stageLabel(l);
              return (
                <tr key={l.id}>
                  <td className="who">
                    <b>{l.name}</b>
                    <small>{l.id}<span className="mob-only"> · {ch.label} · {fmtUsd(l.value)}</span></small>
                  </td>
                  <td className="col-opt"><i className={`dot bg-${ch.slot}`} aria-hidden="true" />{ch.label}</td>
                  <td className="col-opt">{l.service}</td>
                  <td className="r col-opt">{fmtUsd(l.value)}</td>
                  <td><span className={`pill ${st.toLowerCase()}`}><i aria-hidden="true">{ICON[st]}</i>{st}</span></td>
                  <td className="r col-opt">{fmtMinutes(l.responseMin)}</td>
                  <td className="r">{fmtDateTime(l.createdAt)}</td>
                </tr>
              );
            })}
            {!visible.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>No leads match</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>{rows.length ? `${current * PAGE + 1}–${Math.min(rows.length, (current + 1) * PAGE)} of ${rows.length}` : '0'}</span>
        <button type="button" className="ghost-btn" disabled={current === 0} onClick={() => setPage(current - 1)}
          aria-label="Previous page">←</button>
        <button type="button" className="ghost-btn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
          aria-label="Next page">→</button>
      </div>
    </section>
  );
}
