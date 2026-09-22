/**
 * Demo data. A seeded PRNG builds ~190 days of inbound leads for a fictional renovation studio,
 * so every visitor sees the same numbers. Replace `generateLeads` with a fetch from your API.
 *
 * The story baked into the data: 62 days ago the studio automated lead intake
 * (website form → Google Sheets → Telegram alert + instant auto-reply). Response time drops,
 * conversion goes up, and a new channel (the Telegram bot) appears.
 */

export type Channel = 'website' | 'telegram' | 'instagram' | 'referral';

export const CHANNELS: { id: Channel; label: string; slot: number }[] = [
  { id: 'website', label: 'Website form', slot: 1 },
  { id: 'telegram', label: 'Telegram bot', slot: 2 },
  { id: 'instagram', label: 'Instagram', slot: 3 },
  { id: 'referral', label: 'Referral', slot: 4 },
];

export const STAGES = ['New', 'Contacted', 'Qualified', 'Booked', 'Paid'] as const;
export type StageIndex = 0 | 1 | 2 | 3 | 4;

export interface Lead {
  id: string;
  name: string;
  channel: Channel;
  service: string;
  value: number; // USD
  createdAt: number; // epoch ms
  responseMin: number | null; // minutes to first human reply; null = not contacted yet
  reached: StageIndex; // furthest funnel stage
  lost: boolean; // closed without payment
}

export const DAYS = 190; // 2 × 90 days + a week of history for the 7-day average
export const AUTOMATION_DAYS_AGO = 62;
const DAY = 86_400_000;

// mulberry32 — tiny, fast, good enough for demo data
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function poisson(mean: number, rnd: () => number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rnd();
  } while (p > limit);
  return k - 1;
}

function logNormal(median: number, spread: number, rnd: () => number): number {
  // Box–Muller
  const z = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  return median * Math.exp(spread * z);
}

function pick<T>(items: readonly T[], weights: readonly number[], rnd: () => number): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const WEEKDAY = [1.25, 1.2, 1.15, 1.1, 1.0, 0.6, 0.5]; // Mon..Sun
const HOURS = [0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.5, 1.2, 2.2, 3.0, 3.6, 4.0, 4.2, 3.8, 3.3, 3.0,
  2.8, 2.9, 3.4, 4.1, 4.4, 3.6, 2.2, 0.9];
const SERVICES = [
  { name: 'Kitchen remodel', base: 14_000, weight: 3 },
  { name: 'Bathroom remodel', base: 9_000, weight: 4 },
  { name: 'Full renovation', base: 38_000, weight: 1.2 },
  { name: 'Painting', base: 2_400, weight: 3.5 },
  { name: 'Flooring', base: 4_800, weight: 2.5 },
  { name: 'Design consultation', base: 600, weight: 2 },
];
const FIRST = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia',
  'James', 'Amelia', 'Daniel', 'Harper', 'Henry', 'Ella', 'Jack', 'Grace', 'Leo', 'Chloe', 'Owen', 'Zoe',
  'Samuel', 'Nora', 'David', 'Lily', 'Ryan', 'Hannah', 'Adam'];
const LAST = 'ABCDEFGHJKLMNPRSTVWY';

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function generateLeads(now: number = Date.now(), seed = 20260922): Lead[] {
  const rnd = prng(seed);
  const today = startOfDay(now);
  const leads: Lead[] = [];
  let n = 0;

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = today - daysAgo * DAY;
    const weekday = (new Date(dayStart).getDay() + 6) % 7;
    const automated = daysAgo < AUTOMATION_DAYS_AGO;
    const trend = 1 + 0.35 * ((DAYS - 1 - daysAgo) / (DAYS - 1));
    const mean = 8.5 * WEEKDAY[weekday] * trend * (automated ? 1.18 : 1);
    const count = poisson(mean, rnd);

    for (let i = 0; i < count; i += 1) {
      const hour = pick([...HOURS.keys()], HOURS, rnd);
      const createdAt = dayStart + hour * 3_600_000 + Math.floor(rnd() * 3_600_000);
      if (createdAt > now) continue; // today is not over yet

      const channel = pick<Channel>(['website', 'telegram', 'instagram', 'referral'],
        automated ? [0.45, 0.25, 0.18, 0.12] : [0.58, 0.03, 0.22, 0.17], rnd);
      const service = pick(SERVICES, SERVICES.map((s) => s.weight), rnd);
      const value = Math.max(300, Math.round(logNormal(service.base, 0.35, rnd) / 50) * 50);

      const businessHours = hour >= 8 && hour < 20;
      const ageMin = (now - createdAt) / 60_000;
      let responseMin: number | null = automated
        ? logNormal(businessHours ? 2.8 : 35, 0.6, rnd)
        : logNormal(businessHours ? 38 : 540, 0.7, rnd);
      responseMin = Math.max(0.5, Math.round(responseMin * 10) / 10);

      // Funnel. A fast first reply noticeably improves the chance of booking.
      const pContacted = automated ? 0.98 : 0.9;
      const pQualified = automated ? 0.66 : 0.6;
      const pBooked = (automated ? 0.5 : 0.4) + (responseMin < 10 ? 0.06 : 0);
      const pPaid = automated ? 0.88 : 0.84;
      let reached: StageIndex = 0;
      if (rnd() < pContacted) {
        reached = 1;
        if (rnd() < pQualified) {
          reached = 2;
          if (rnd() < pBooked) {
            reached = 3;
            if (rnd() < pPaid) reached = 4;
          }
        }
      }

      if (reached === 0) responseMin = null; // never reached: wrong number, spam, changed their mind

      // Fresh leads have not had time to move through the pipeline yet.
      if (responseMin !== null && responseMin > ageMin) {
        responseMin = null;
        reached = 0;
      } else if (ageMin < 1440 && reached > 2) {
        reached = 2; // booking usually happens on day two, after the site visit
      } else if (ageMin < 4 * 1440 && reached > 3) {
        reached = 3; // payment comes a few days after booking
      }

      n += 1;
      leads.push({
        id: `L-${String(10000 + n)}`,
        name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}.`,
        channel,
        service: service.name,
        value,
        createdAt,
        responseMin,
        reached,
        lost: reached < 3 && ageMin > 10 * 1440,
      });
    }
  }
  return leads.sort((a, b) => a.createdAt - b.createdAt);
}
