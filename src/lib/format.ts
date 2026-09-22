const int = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});

export const fmtInt = (n: number) => int.format(n);
export const fmtUsd = (n: number) => usd.format(n);
export const fmtUsdCompact = (n: number) => usdCompact.format(n);
export const fmtPct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function fmtMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtWeekday = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "+12%" / "−8%": a real minus sign, so the sign never reads as a hyphen. */
export function fmtSigned(x: number, digits = 0, suffix = '%'): string {
  const v = Math.abs(x).toFixed(digits);
  if (Number(v) === 0) return `0${suffix}`;
  return `${x > 0 ? '+' : '−'}${v}${suffix}`;
}
