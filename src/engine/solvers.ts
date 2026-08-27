import type { Settings } from './types';
import { compute, feasible, reachableNow, savingPerYear } from './compute';
import { fmtMoney } from './format';

/**
 * The three questions the tool exists to answer. Each one re-runs the whole
 * projection dozens of times, so memoise at the call site (see useProjection)
 * rather than calling them straight from a render.
 */

export interface EarliestExit {
  age: number;
  /** Years relative to the planned exit. Negative means sooner. */
  delta: number;
}

/** The soonest you could stop and still have the money last. */
export function earliestExit(s: Settings): EarliestExit | null {
  for (let d = -20; d <= 30; d++) {
    const age = s.exit_age + d;
    // Can't stop before today, and there's no plan left if you stop at the end.
    if (age < s.current_age || age >= s.plan_to) continue;
    if (feasible(compute({ ...s, exit_age: age }))) return { age, delta: d };
  }
  return null;
}

/** The most you could spend each year and still not run out. */
export function maxSpend(s: Settings): number | null {
  const LO = 1_000;
  const HI = 1_000_000;
  if (!feasible(compute({ ...s, annual_spend: LO }))) return null;

  let lo = LO;
  let hi = HI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (feasible(compute({ ...s, annual_spend: mid }))) lo = mid;
    else hi = mid;
  }
  return lo;
}

export interface EnoughToday {
  /** The smallest pot you could hold today and still have the plan work. */
  need: number;
  /** What you actually hold today: everything, pension included. */
  have: number;
  /** How much more you need. Present only when the plan doesn't work. */
  shortfall?: number;
  /** How much you could lose and still be fine. Present only when it does. */
  surplus?: number;
}

/**
 * The smallest pot you could hold today and still have this plan survive.
 *
 * Both pots are scaled together, keeping the mix you actually have, because
 * the pension and the money outside it are not interchangeable: one is taxed
 * and locked until an access age, the other is neither.
 *
 * This used to subtract from the non-pension pot alone, while allowing itself
 * to subtract as much as the two pots combined. On a plan with £480k invested
 * and £126k in a pension it would happily test a balance of minus £126,000,
 * decide that worked, and report that £86k was enough.
 */
export function enoughToday(s: Settings): EnoughToday {
  const have = reachableNow(s) + s.pension_now;

  /** The plan with both pots scaled by `f`. */
  const at = (f: number) =>
    compute({
      ...s,
      isa_now: s.isa_now * f,
      gia_now: s.gia_now * f,
      other_now: s.other_now * f,
      pension_now: s.pension_now * f,
    });

  // With nothing saved there is nothing to scale, so grow the reachable pot.
  if (have <= 0) {
    let lo = 0;
    let hi = 20_000_000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      // Nothing saved, so there is no mix to keep. New money goes to the ISA,
      // which is what anyone starting from zero would fill first.
      if (feasible(compute({ ...s, isa_now: mid }))) hi = mid;
      else lo = mid;
    }
    return { need: hi, have, shortfall: hi };
  }

  if (feasible(at(1))) {
    // The smallest share of what you hold that still works.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2;
      if (feasible(at(mid))) hi = mid;
      else lo = mid;
    }
    const need = have * hi;
    return { need, have, surplus: have - need };
  }

  // Not enough: how much more of the same mix would do it?
  let hi = 2;
  while (hi < 1e5 && !feasible(at(hi))) hi *= 2;
  if (!feasible(at(hi))) return { need: Infinity, have, shortfall: Infinity };

  let lo = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (feasible(at(mid))) hi = mid;
    else lo = mid;
  }
  const need = have * hi;
  return { need, have, shortfall: need - have };
}

/**
 * How much more you would have to save each year for the plan to hold.
 *
 * Sits alongside `enoughToday`: that one answers "what pot do I need right
 * now", this one answers "what could I add between now and stopping". Returns
 * null if the plan already works, or if no amount of saving rescues it.
 */
export function extraSavingNeeded(s: Settings): number | null {
  if (feasible(compute(s))) return null;

  const start = savingPerYear(s);
  let lo = start;
  let hi = start + 2_000_000;
  // Added to the ISA: of the two reachable accounts it is the better one,
  // so it is what someone would actually fill.
  const at = (total: number) => ({ ...s, isa_per_year: Math.max(0, total - s.gia_per_year) });
  if (!feasible(compute(at(hi)))) return null;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (feasible(compute(at(mid)))) hi = mid;
    else lo = mid;
  }
  // The extra on top of what they already save, rounded to something sayable.
  return Math.ceil((hi - start) / 500) * 500;
}

/**
 * What a change is worth in today's money.
 *
 * `enoughToday().need` is the smallest pot that makes a plan work, and it is
 * defined the same way whether the plan currently holds or not. So the drop in
 * that figure after a change is the single unit every move can be quoted in:
 * a move worth 68,000 is as good as having 68,000 more in the bank right now.
 *
 * This is what makes the moves comparable to each other and to the headline
 * "how much is enough" figure. Before, each one reported its effect in its own
 * units and none of them lined up.
 */
export function worthToday(base: Settings, patch: Partial<Settings>): number {
  const before = enoughToday(base).need;
  const after = enoughToday({ ...base, ...patch }).need;
  return before - after;
}


/**
 * What a change buys you in spending money, every year, for the whole plan.
 *
 * The counterpart to `worthToday`, and the right measure once a plan already
 * works. At that point `enoughToday` has bottomed out, so the pot you "need"
 * barely moves and everything is worth suspiciously little. Extra spending is
 * continuous, always meaningful, and is what you would actually do with it.
 */
export function spendGain(base: Settings, patch: Partial<Settings>): number {
  const before = maxSpend(base);
  const after = maxSpend({ ...base, ...patch });
  if (before === null || after === null) return 0;
  return after - before;
}

/** Split a reachable total across the two accounts, keeping today's ratio. */
function splitReachable(s: Settings, total: number): Pick<Settings, 'isa_per_year' | 'gia_per_year'> {
  const now = savingPerYear(s);
  const giaShare = now > 0 ? s.gia_per_year / now : 0;
  return { gia_per_year: total * giaShare, isa_per_year: total * (1 - giaShare) };
}

export interface BestMix {
  /** The settings to adopt, ready to drop into a draft. */
  patch: Partial<Settings>;
  /** Yearly spending ceiling as things stand, and at the recommendation. */
  spendNow: number;
  spendBest: number;
  /** Plain sentences describing each part of the recommendation. */
  says: string[];
}

/**
 * The best combination of the three choices, found rather than guessed.
 *
 * Clearing a mortgage, splitting saving between the pension and money you can
 * reach, and choosing a wrapper for the rest are not independent. Clearing the
 * mortgage empties the pot the bridge years are paid from, which changes what
 * the pension is worth, which changes how much taxable money is left to
 * shelter. Optimising them one at a time gives three answers that cannot be
 * added together.
 *
 * Solved by coordinate descent: sweep one lever over a coarse grid holding the
 * others still, take the winner, move to the next, repeat. A full grid over
 * all three is tens of thousands of projections and far too slow to run while
 * someone is dragging a slider; three passes over three levers is about a
 * hundred, and on a surface this smooth it lands in the same place.
 *
 * Scored on yearly spending, like everything else on that page, because a
 * terminal balance fifty years out says more about the return assumption than
 * about the choice being made.
 */
export function bestMix(s: Settings): BestMix | null {
  const score = (c: Settings) => (feasible(compute(c)) ? maxSpend(c) ?? 0 : 0);

  const hasMortgage = s.mortgage_balance > 0 && s.mortgage_paid_by > s.current_age;
  const budget = savingPerYear(s) + s.pension_per_year;
  const canWrapper = savingPerYear(s) > 0 && s.cgt_rate > 0;
  if (!hasMortgage && budget <= 0 && !canWrapper) return null;

  const spendNow = score(s);
  let cur: Settings = { ...s };
  let best = spendNow;

  /** Try each candidate patch, keep the one that spends most. */
  const sweep = (patches: Partial<Settings>[]) => {
    for (const p of patches) {
      const cand = { ...cur, ...p };
      const v = score(cand);
      if (v > best + 0.5) {
        best = v;
        cur = cand;
      }
    }
  };

  for (let pass = 0; pass < 3; pass++) {
    const startOfPass = best;

    if (hasMortgage) {
      /*
       * The offset, and only the offset.
       *
       * Clearing it in one go used to be swept here as well. A mortgage with
       * a term already has an end date, so a second way to end it was two
       * controls for one decision, and sweeping every possible payoff age
       * cost more projections than the rest of this function together.
       */
      const cap = Math.min(s.mortgage_balance, reachableNow(s));
      if (cap > 0) {
        sweep(Array.from({ length: 9 }, (_, i) => ({ mortgage_offset: (cap * i) / 8 })));
        const o0 = cur.mortgage_offset;
        sweep(
          [-2, -1, 1, 2]
            .map((d) => o0 + (d * cap) / 16)
            .filter((v) => v >= 0 && v <= cap)
            .map((v) => ({ mortgage_offset: v })),
        );
      }
    }

    if (budget > 0) {
      const cap =
        s.pension_annual_allowance > 0 ? Math.min(budget, s.pension_annual_allowance) : budget;
      const at = (v: number) => ({
        pension_per_year: Math.min(v, cap),
        // The reachable side keeps whatever mix of ISA and general account it
        // already had, so this question stays about the pension alone.
        ...splitReachable(s, budget - Math.min(v, cap)),
      });
      sweep(Array.from({ length: 11 }, (_, i) => at((cap * i) / 10)));
      const p0 = cur.pension_per_year;
      sweep([-2, -1, 1, 2].map((d) => at(Math.max(0, Math.min(cap, p0 + (d * cap) / 20)))));
    }

    if (canWrapper) {
      const reach = savingPerYear(cur);
      const atPct = (pct: number) => ({
        gia_per_year: (reach * pct) / 100,
        isa_per_year: reach - (reach * pct) / 100,
      });
      sweep([0, 25, 50, 75, 100].map(atPct));
      const t0 = reach > 0 ? (cur.gia_per_year / reach) * 100 : 0;
      sweep(
        [-10, -5, 5, 10]
          .map((d) => t0 + d)
          .filter((v) => v >= 0 && v <= 100)
          .map(atPct),
      );
    }

    // Nothing moved this pass, so nothing will move next pass either.
    if (best <= startOfPass + 0.5) break;
  }

  const patch: Partial<Settings> = {};
  const says: string[] = [];

  if (hasMortgage) {
    patch.mortgage_offset = cur.mortgage_offset;
    says.push(
      cur.mortgage_offset > 0
        ? `offset ${fmtMoney(cur.mortgage_offset)} against the mortgage`
        : 'keep paying the mortgage',
    );
  }
  if (budget > 0) {
    patch.pension_per_year = cur.pension_per_year;
    patch.isa_per_year = cur.isa_per_year;
    patch.gia_per_year = cur.gia_per_year;
    says.push(
      cur.pension_per_year <= 0
        ? 'put nothing into the pension'
        : `put ${fmtMoney(cur.pension_per_year)} a year into the pension`,
    );
  }
  if (canWrapper) {
    patch.isa_per_year = cur.isa_per_year;
    patch.gia_per_year = cur.gia_per_year;
    says.push(
      cur.gia_per_year <= 0
        ? 'put the rest in an ISA'
        : cur.isa_per_year <= 0
          ? 'put the rest in a general account'
          : `split the rest ${fmtMoney(cur.isa_per_year)} ISA and ${fmtMoney(cur.gia_per_year)} general`,
    );
  }

  return { patch, spendNow, spendBest: best, says };
}

/**
 * The smallest yearly spending cut that makes a failing plan hold.
 *
 * Not a tenth of what you spend, which is what the moves list used to offer.
 * A tenth is a guess: on one plan it is twice what is needed and on the next
 * it is not close. The number people actually want is the least they can give
 * up and still be alright, and that is a search, not a fraction.
 *
 * Null when the plan already holds, or when no cut is enough.
 */
export function minTrim(s: Settings): number | null {
  if (feasible(compute(s))) return null;
  if (!feasible(compute({ ...s, annual_spend: 0 }))) return null;

  let lo = 0;
  let hi = s.annual_spend;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (feasible(compute({ ...s, annual_spend: mid }))) lo = mid;
    else hi = mid;
  }
  const cut = s.annual_spend - lo;
  return cut > 1 ? Math.ceil(cut / 100) * 100 : null;
}



/**
 * The smallest yearly work income that makes a failing plan hold.
 *
 * Same idea as the trim. "A fifth of your spending" was a stand-in for the
 * answer; this is the answer.
 */
export function minEarnings(s: Settings): number | null {
  if (feasible(compute(s))) return null;
  const until = Math.min(s.plan_to, s.exit_age + 10);
  const HI = Math.max(200_000, s.annual_spend * 3);
  if (!feasible(compute({ ...s, earnings_per_year: HI, earn_until_age: until }))) return null;

  let lo = 0;
  let hi = HI;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (feasible(compute({ ...s, earnings_per_year: mid, earn_until_age: until }))) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 500) * 500;
}
