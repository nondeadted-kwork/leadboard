import { describe, expect, it } from 'vitest';
import { generateLeads, type Lead } from './generate';
import {
  automationImpact, byChannel, daily, DAY, delta, funnel, heatmap, inRange, kpis, median, rangesFor, rolling,
} from './metrics';

const NOW = new Date('2026-09-22T15:30:00').getTime();
const leads = generateLeads(NOW);

function lead(partial: Partial<Lead>): Lead {
  return { id: 'L', name: 'A', channel: 'website', service: 'Painting', value: 1000, createdAt: NOW,
    responseMin: 5, reached: 1, lost: false, ...partial };
}

describe('generator', () => {
  it('is deterministic for the same seed and date', () => {
    expect(generateLeads(NOW)).toEqual(leads);
  });

  it('never creates leads in the future and keeps the funnel consistent', () => {
    expect(leads.length).toBeGreaterThan(1500);
    for (const l of leads) {
      expect(l.createdAt).toBeLessThanOrEqual(NOW);
      if (l.reached === 0) expect(l.responseMin).toBeNull();
      if (l.lost) expect(l.reached).toBeLessThan(3);
    }
  });
});

describe('metrics', () => {
  it('ranges cover whole days and the previous period touches the current one', () => {
    const { current, previous } = rangesFor(7, NOW);
    expect(current.end - current.start).toBe(7 * DAY);
    expect(previous.end).toBe(current.start);
    expect(new Date(current.start).getHours()).toBe(0);
  });

  it('median handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('delta refuses to divide by zero', () => {
    expect(delta(12, 10)).toBeCloseTo(0.2);
    expect(delta(5, 0)).toBeNull();
    expect(delta(null, 3)).toBeNull();
  });

  it('kpis count booked revenue only for booked or paid leads', () => {
    const k = kpis([lead({ reached: 3, value: 500 }), lead({ reached: 4, value: 700 }), lead({ reached: 2, value: 9000 }),
      lead({ reached: 0, responseMin: null })]);
    expect(k).toEqual({ leads: 4, medianResponse: 5, bookedRate: 0.5, bookedRevenue: 1200 });
  });

  it('daily and channel buckets add up to the same total', () => {
    const { current } = rangesFor(30, NOW);
    const slice = inRange(leads, current);
    const days = daily(slice, current);
    expect(days).toHaveLength(30);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(slice.length);
    const weeks = byChannel(slice, current, 7);
    expect(weeks.reduce((s, w) => s + w.total, 0)).toBe(slice.length);
  });

  it('rolling average uses a trailing window', () => {
    const pts = [2, 4, 6, 8].map((count, i) => ({ date: i, count }));
    expect(rolling(pts, 3).map((p) => p.count)).toEqual([2, 3, 4, 6]);
  });

  it('funnel is monotone and starts at 100%', () => {
    const steps = funnel(leads);
    expect(steps[0].ofTotal).toBe(1);
    for (let i = 1; i < steps.length; i += 1) expect(steps[i].count).toBeLessThanOrEqual(steps[i - 1].count);
  });

  it('heatmap has 7 × 24 cells and loses no lead', () => {
    const grid = heatmap(leads);
    expect(grid).toHaveLength(7);
    expect(grid.flat().reduce((s, v) => s + v, 0)).toBe(leads.length);
  });

  it('the demo story holds: automation made replies faster and conversion higher', () => {
    const { before, after } = automationImpact(leads, NOW);
    expect(after.medianResponse!).toBeLessThan(before.medianResponse! / 5);
    expect(after.bookedRate!).toBeGreaterThan(before.bookedRate!);
  });
});
