import { CURRENCIES, type Currency } from './types';

/* ── currency ──────────────────────────────────────────────────────────────
   Held module-level rather than threaded through every formatter. It changes
   about once in the life of a plan, and App re-renders on the same state
   change that sets it.
   ──────────────────────────────────────────────────────────────────────── */

let active: Currency = CURRENCIES[0];

export function setCurrency(code: string): void {
  active = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function currency(): Currency {
  return active;
}

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** U+2212 minus, not a hyphen. It lines up with tabular figures. */
const MINUS = '−';

export function monthName(m: number): string {
  return MONTHS[(m - 1 + 12) % 12];
}

/** Jan 2031 */
export function fmtMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** £358,940, or −£12,400 when negative. */
export function fmtMoney(n: number): string {
  const neg = n < 0;
  const body = Math.round(Math.abs(n)).toLocaleString(active.locale);
  return (neg ? MINUS : '') + active.symbol + body;
}

/** Always carries a sign: +£4,200 / −£4,200 / ±£0. Used for deltas. */
export function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? MINUS : '±';
  return sign + active.symbol + Math.round(Math.abs(n)).toLocaleString(active.locale);
}

/** £359k, £1.2m, for axes and headline figures where width matters. */
export function fmtShort(v: number): string {
  const sign = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  if (a >= 1e6) {
    return `${sign}${active.symbol}${(a / 1e6).toFixed(a >= 9.5e6 ? 0 : 1).replace(/\.0$/, '')}m`;
  }
  if (a >= 1e3) return `${sign}${active.symbol}${Math.round(a / 1e3)}k`;
  return `${sign}${active.symbol}${Math.round(a)}`;
}

/** Parse typed money. Strips symbol, commas and spaces; honours 74k / 1.2m. */
export function parseMoney(raw: string): number | null {
  const cleaned = String(raw)
    .trim()
    .replace(/[£$€,\s]/g, '')
    .replace(/^[A-Za-z]{0,2}\$/, '');
  const m = cleaned.match(/^(-?\d*\.?\d+)([km])?$/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (!isFinite(n)) return null;
  if (m[2]) n *= m[2].toLowerCase() === 'k' ? 1e3 : 1e6;
  return n;
}

/** "3y 4m" / "8 months" / "now" */
export function fmtDuration(months: number): string {
  if (months <= 0) return 'now';
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} years` : `${y}y ${m}m`;
}

/** Axis ticks at round numbers: 1, 2 or 5 times a power of ten. */
export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 5 * mag : norm >= 2 ? 2 * mag : norm >= 1 ? 1 * mag : 0.5 * mag;
  // Rounded to whole units, so a small span can round two steps to the same
  // number. They are used as React keys, which then collide.
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-6; t += step) {
    const v = Math.round(t);
    if (out.length === 0 || out[out.length - 1] !== v) out.push(v);
  }
  return out;
}
