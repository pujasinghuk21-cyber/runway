import type { Settings } from './types';
import { compute, realRate } from './compute';

/**
 * How likely is this plan to work?
 *
 * The plan page runs one return, the same every year, and asks whether the
 * money lasts. That question has a yes or no answer and it is the wrong
 * question, because nobody gets an average. You get a sequence, and a plan
 * that survives a flat 5.5% can fail on a sequence that averages 5.5% with
 * the bad years at the front. Selling units into a fall in the years the pot
 * is largest is what actually ends early retirements, and a flat rate cannot
 * see it. Neither can a lower flat rate, which is all "poor markets" was.
 *
 * So: draw many sequences with the same average and a stated volatility, run
 * the plan down each one, and count.
 *
 * Returns are drawn log-normal. Real equity returns are not truly log-normal
 * and the real world has fat tails and some mean reversion, so this
 * understates the extremes in both directions. It is a large improvement on
 * a constant and still a model.
 *
 * Everything here is deterministic given a seed, so the same plan always
 * gives the same answer and the screen does not flicker while you type.
 */

/** mulberry32. Small, fast, and good enough for this. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller. One call, one standard normal. */
function normal(next: () => number): number {
  let u = 0;
  while (u === 0) u = next();
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface RiskOptions {
  /** Yearly standard deviation of the real return, %. */
  volatility: number;
  trials: number;
  seed: number;
}

export const RISK_DEFAULTS: RiskOptions = {
  // Global equities have run around 15 to 17% a year in real terms. A mixed
  // portfolio is lower. This is a setting rather than a constant because the
  // right number depends on what you actually hold.
  volatility: 15,
  trials: 600,
  seed: 20260827,
};

export interface RiskResult {
  trials: number;
  volatility: number;
  /** Share of sequences where the money lasts to the end, 0 to 1. */
  successRate: number;
  /** Ages the money ran out, at the 5th, 50th and 95th percentile of failures. */
  ruinAges: { p5: number; p50: number; p95: number } | null;
  /** Everything you have at the end, across all sequences. */
  endBal: { p10: number; p50: number; p90: number };
  /** Balance percentiles per age, for drawing a fan. */
  bands: { age: number; p10: number; p50: number; p90: number }[];
}

function pick(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

/**
 * One drawn sequence of yearly real returns.
 *
 * The rate you type is treated as the **compound** rate, the one your money
 * actually grows at, because that is what the plan page compounds it at and
 * what published long-run figures quote. So the drift is ln(1 + rate) and the
 * median sequence compounds at exactly the rate you asked for.
 *
 * The first version set the drift so the *arithmetic* mean matched instead.
 * That is the other common convention and it is wrong here: it drops the
 * median compound rate by half the variance, about 1.1 points at 15%
 * volatility, which over fifty years is enormous. It made a plan look far
 * worse than it is for no reason other than a definition.
 */
function drawPath(years: number, rate: number, vol: number, next: () => number): number[] {
  const m = Math.log(1 + rate);
  const out: number[] = [];
  for (let i = 0; i < years; i++) out.push(Math.exp(m + vol * normal(next)) - 1);
  return out;
}

export function runRisk(s: Settings, opts: RiskOptions = RISK_DEFAULTS): RiskResult {
  const years = Math.max(1, s.plan_to - s.exit_age + 1);
  const mean = realRate(s.growth_after, s.inflation);
  const vol = Math.max(0, opts.volatility) / 100;
  const next = rng(opts.seed);

  let lasted = 0;
  const ruin: number[] = [];
  const ends: number[] = [];
  const byYear: number[][] = Array.from({ length: years }, () => []);

  for (let t = 0; t < opts.trials; t++) {
    const res = compute(s, drawPath(years, mean, vol, next));
    if (res.runsOutAge === null) lasted++;
    else ruin.push(res.runsOutAge);
    ends.push(res.endBal);
    res.rows.forEach((row, i) => {
      if (i < years) byYear[i].push(row.end + row.pensionEnd);
    });
  }

  ruin.sort((a, b) => a - b);
  ends.sort((a, b) => a - b);

  return {
    trials: opts.trials,
    volatility: opts.volatility,
    successRate: lasted / opts.trials,
    ruinAges: ruin.length
      ? { p5: pick(ruin, 0.05), p50: pick(ruin, 0.5), p95: pick(ruin, 0.95) }
      : null,
    endBal: { p10: pick(ends, 0.1), p50: pick(ends, 0.5), p90: pick(ends, 0.9) },
    bands: byYear.map((vals, i) => {
      const v = [...vals].sort((a, b) => a - b);
      return { age: s.exit_age + i, p10: pick(v, 0.1), p50: pick(v, 0.5), p90: pick(v, 0.9) };
    }),
  };
}

/**
 * The most you could spend and still succeed this often.
 *
 * The plan page's ceiling is the most you can spend if the return never
 * varies, which is a promise nobody can keep. This is the same question asked
 * of the sequences, and it comes out lower. The gap between the two is the
 * price of pretending returns are smooth.
 */
export function safeSpend(s: Settings, target: number, opts: RiskOptions = RISK_DEFAULTS): number {
  // Fewer trials here: this runs the whole thing twenty times over, and the
  // search only needs to know which side of the target it is on.
  const cheap: RiskOptions = { ...opts, trials: Math.max(150, Math.round(opts.trials / 3)) };
  let lo = 0;
  let hi = Math.max(10_000, s.annual_spend * 4);
  if (runRisk({ ...s, annual_spend: lo }, cheap).successRate < target) return 0;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (runRisk({ ...s, annual_spend: mid }, cheap).successRate >= target) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 100) * 100;
}
