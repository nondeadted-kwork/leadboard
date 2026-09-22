/** Pure aggregation functions: leads in → numbers for tiles and charts out. No React, easy to test. */
import { AUTOMATION_DAYS_AGO, CHANNELS, type Channel, type Lead, STAGES, startOfDay } from './generate';

export const DAY = 86_400_000;

export interface Range {
  start: number; // inclusive, epoch ms
  end: number; // exclusive
}

/** Last N calendar days including today, plus the N days before them. */
export function rangesFor(days: number, now: number): { current: Range; previous: Range } {
  const end = startOfDay(now) + DAY;
  const start = end - days * DAY;
  return { current: { start, end }, previous: { start: start - days * DAY, end: start } };
}

export function inRange(leads: Lead[], range: Range, channel: Channel | 'all' = 'all'): Lead[] {
  return leads.filter((l) => l.createdAt >= range.start && l.createdAt < range.end
    && (channel === 'all' || l.channel === channel));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Kpis {
  leads: number;
  medianResponse: number | null; // minutes
  bookedRate: number | null; // 0..1
  bookedRevenue: number; // USD
}

export function kpis(leads: Lead[]): Kpis {
  const booked = leads.filter((l) => l.reached >= 3);
  return {
    leads: leads.length,
    medianResponse: median(leads.flatMap((l) => (l.responseMin === null ? [] : [l.responseMin]))),
    bookedRate: leads.length ? booked.length / leads.length : null,
    bookedRevenue: booked.reduce((s, l) => s + l.value, 0),
  };
}

/** Relative change, or null when there is nothing to compare with. */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

/** Splits a range into `n` equal buckets and applies `fn` to each — for sparklines. */
export function buckets<T>(leads: Lead[], range: Range, n: number, fn: (items: Lead[]) => T): T[] {
  const size = (range.end - range.start) / n;
  const groups: Lead[][] = Array.from({ length: n }, () => []);
  for (const l of leads) {
    const i = Math.min(n - 1, Math.floor((l.createdAt - range.start) / size));
    if (i >= 0) groups[i].push(l);
  }
  return groups.map(fn);
}

export interface DayPoint {
  date: number; // start of day
  count: number;
}

export function daily(leads: Lead[], range: Range): DayPoint[] {
  const days = Math.round((range.end - range.start) / DAY);
  const points: DayPoint[] = Array.from({ length: days }, (_, i) => ({ date: range.start + i * DAY, count: 0 }));
  for (const l of leads) {
    const i = Math.floor((l.createdAt - range.start) / DAY);
    if (i >= 0 && i < days) points[i].count += 1;
  }
  return points;
}

/** Trailing moving average. The first `window - 1` points use what is available. */
export function rolling(points: DayPoint[], window: number): DayPoint[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { date: p.date, count: slice.reduce((s, x) => s + x.count, 0) / slice.length };
  });
}

export interface ChannelBucket {
  start: number;
  end: number;
  counts: Record<Channel, number>;
  total: number;
}

/** Leads per channel per bucket: daily for short ranges, weekly for 90 days. */
export function byChannel(leads: Lead[], range: Range, bucketDays: number): ChannelBucket[] {
  const out: ChannelBucket[] = [];
  for (let s = range.start; s < range.end; s += bucketDays * DAY) {
    const e = Math.min(range.end, s + bucketDays * DAY);
    const counts = Object.fromEntries(CHANNELS.map((c) => [c.id, 0])) as Record<Channel, number>;
    out.push({ start: s, end: e, counts, total: 0 });
  }
  for (const l of leads) {
    const i = Math.floor((l.createdAt - range.start) / (bucketDays * DAY));
    if (i >= 0 && i < out.length) {
      out[i].counts[l.channel] += 1;
      out[i].total += 1;
    }
  }
  return out;
}

export interface FunnelStep {
  stage: (typeof STAGES)[number];
  count: number;
  ofTotal: number; // share of all leads
  ofPrevious: number | null; // conversion from the previous stage
}

export function funnel(leads: Lead[]): FunnelStep[] {
  const counts = STAGES.map((_, i) => leads.filter((l) => l.reached >= i).length);
  return STAGES.map((stage, i) => ({
    stage,
    count: counts[i],
    ofTotal: counts[0] ? counts[i] / counts[0] : 0,
    ofPrevious: i === 0 ? null : counts[i - 1] ? counts[i] / counts[i - 1] : 0,
  }));
}

/** 7 × 24 grid: rows Mon..Sun, columns hour of day (local time). */
export function heatmap(leads: Lead[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const l of leads) {
    const d = new Date(l.createdAt);
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  return grid;
}

/** Before/after the automation launch, for the headline callout. */
export function automationImpact(leads: Lead[], now: number) {
  const launch = startOfDay(now) - AUTOMATION_DAYS_AGO * DAY;
  const window = 60 * DAY;
  // Leads younger than 10 days are excluded: they have not had time to book yet.
  const matureUntil = now - 10 * DAY;
  const before = kpis(leads.filter((l) => l.createdAt >= launch - window && l.createdAt < launch));
  const after = kpis(leads.filter((l) => l.createdAt >= launch && l.createdAt < matureUntil));
  return { launch, before, after };
}

export function stageLabel(l: Lead): string {
  if (l.lost) return 'Lost';
  return STAGES[l.reached];
}
