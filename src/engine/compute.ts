import type { Settings, Projection, YearRow } from './types';

/* ── timing ────────────────────────────────────────────────────────────────
   The exit date is derived from the two ages, never stored. The old build
   kept an exit year/month *and* an exit age as separate levers, which could
   drift apart and quietly disagree with each other.
   ──────────────────────────────────────────────────────────────────────── */

/* ── the three accounts, and the two totals the projection works in ─────── */

/**
 * Everything you can reach before the pension opens.
 *
 * `gia_now` is the only part of this the capital gains maths touches. The
 * other two are sheltered or cash, so they are spendable without a tax bill.
 */
export const reachableNow = (s: Settings): number =>
  Math.max(0, s.isa_now) + Math.max(0, s.gia_now) + Math.max(0, s.other_now);

/** Everything you put away each year outside the pension. */
export const savingPerYear = (s: Settings): number =>
  Math.max(0, s.isa_per_year) + Math.max(0, s.gia_per_year);

/** The share of that yearly saving landing somewhere taxable, 0 to 1. */
export const savingTaxableShare = (s: Settings): number => {
  const total = savingPerYear(s);
  return total > 0 ? Math.max(0, s.gia_per_year) / total : 0;
};

/* ── the mortgage ──────────────────────────────────────────────────────── */

export interface MortgageSchedule {
  /** What you pay each year, in today's money at the start. */
  payment: number;
  /** The real cost of each year, indexed from your current age. */
  realCost: number[];
  /** Age the balance reaches zero, or null if the term outruns the plan. */
  clearAge: number | null;
  /** Every pound of interest, in today's money. */
  interest: number;
}

const EMPTY_MORTGAGE: MortgageSchedule = { payment: 0, realCost: [], clearAge: null, interest: 0 };

/**
 * A mortgage, worked the way a mortgage actually works.
 *
 * Balance, rate and term give the payment. That is the whole of it, and it is
 * the sum every lender and every calculator does. Typing the payment instead
 * meant three of the four numbers on your statement could go in and the
 * fourth had to be invented.
 *
 * Two things this gets right that a simpler version would not:
 *
 * The schedule runs in nominal money, because that is what a mortgage is: a
 * rate your lender quotes and a payment fixed in pounds. Each year's payment
 * is then brought back to today's money to join the rest of the plan. This
 * matters more than it sounds. A payment fixed in pounds shrinks in real
 * terms every year, so on a 25 year term at 2.5% inflation the last payment
 * costs about half what the first one did, and treating them all as equal
 * would overstate the burden for two decades.
 *
 * And an offset shortens the term rather than cutting the payment, which is
 * how they are sold. The payment is set on the full balance; the parked money
 * only stops interest accruing, so the same payment clears the debt sooner.
 */
export function mortgageSchedule(s: Settings): MortgageSchedule {
  const balance = Math.max(0, s.mortgage_balance);
  const rate = Math.max(0, s.mortgage_rate) / 100;
  // An age in, a term out. Everything below is in years from today.
  const term = Math.max(0, Math.round(s.mortgage_paid_by) - Math.round(s.current_age));
  const infl = Math.max(0, s.inflation) / 100;
  if (balance <= 0 || term <= 0) return EMPTY_MORTGAGE;

  // The standard amortisation payment. At a zero rate it is just the balance
  // spread evenly, which the formula cannot express.
  const payment = rate > 0 ? (balance * rate) / (1 - Math.pow(1 + rate, -term)) : balance / term;

  let owed = balance;
  const realCost: number[] = [];
  let interest = 0;
  let clearAge: number | null = null;

  // A guard, not a term: an offset can only ever shorten this, never lengthen
  // it, so the loop is bounded by the term it started with.
  for (let t = 0; t < term && owed > 0.01; t++) {
    // The offset is an amount of today's money, so it keeps pace with prices.
    const parked = Math.min(s.mortgage_offset * Math.pow(1 + infl, t), owed);
    const charged = Math.max(0, owed - parked) * rate;
    const paid = Math.min(payment, owed + charged);
    owed = owed + charged - paid;

    const toToday = Math.pow(1 + infl, -t);
    realCost.push(paid * toToday);
    interest += charged * toToday;
    // The age it is clear, not the last age you pay. This held the payment
    // year, so a mortgage the field said was "paid off by age 41" reported
    // back as "paid off at 40" directly underneath the box you typed 41 into.
    if (owed <= 0.01) clearAge = s.current_age + t + 1;
  }

  return { payment, realCost, clearAge, interest };
}

/**
 * What the mortgage costs in one particular year, in today's money.
 *
 * The screen kept quoting `payment`, which is a rate with no end date on it.
 * A mortgage has an end date, and `realCost` is where it lives: one entry per
 * year it runs and nothing after. Ask for a year outside the term and the
 * answer is zero, which is the whole point.
 *
 * This is the same lookup the drawdown loop does, so anything that reports
 * your spending now agrees with what the projection charges you.
 */
export function mortgageCostAt(s: Settings, age: number): number {
  const i = Math.round(age) - Math.round(s.current_age);
  return mortgageSchedule(s).realCost[i] ?? 0;
}

export function monthsToExit(s: Settings): number {
  return Math.max(0, Math.round((s.exit_age - s.current_age) * 12));
}

/** The calendar date you stop working, derived from today plus the gap. */
export function exitDate(s: Settings): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsToExit(s));
  return d;
}

/* ── the projection ────────────────────────────────────────────────────── */

/**
 * Run the plan year by year, from the age you stop working to the age you
 * plan to. Everything is real (after inflation), so figures stay in today's
 * money.
 *
 * Two pots stay separate for the whole plan, because they are taxed
 * differently:
 *   - `liquid`:  money outside the pension. Spending it is not taxed.
 *   - `pension`: locked until `pension_access_age`, and taxed on the way out.
 *
 * They used to be merged: the whole pension was tipped into `liquid` on the
 * access birthday. That made tax impossible to model, because once the pots
 * are one pile there is no way to know how much of a given year's spending is
 * taxable. Keeping them apart is what lets the ISA-versus-pension trade-off
 * mean anything.
 *
 * Money is drawn in the order that costs least tax: income first, then money
 * outside the pension, then the pension. The gap between stopping work and
 * the pension unlocking is the "bridge", and it's where plans actually fail,
 * so the low point across those years is reported separately.
 */
/**
 * @param path Optional real return for each drawdown year, as a fraction.
 *   Absent means the flat `real_return` for every year, which is the whole
 *   plan page. Supplied means one drawn sequence, which is how sequence risk
 *   is measured: the average is not what kills an early retirement, the order
 *   is, because a fall in the first years sells the most units.
 *   It applies to the drawdown only. The years before you stop are a closed
 *   form above and are short by comparison.
 */
/**
 * A headline rate, less inflation, as a fraction.
 *
 * Not a subtraction: 8% growth with 3% inflation leaves 4.854%, not 5%. The
 * difference is small in one year and about 4% of the final pot over fifty,
 * which is more than enough to be worth getting right.
 */
export const realRate = (nominal: number, inflation: number): number =>
  (1 + nominal / 100) / (1 + inflation / 100) - 1;

export function compute(s: Settings, path?: readonly number[]): Projection {
  /*
   * One rate for both halves of the plan.
   *
   * `g` compounds what you hold up to the exit age and `r` runs the drawdown.
   * They used to come from two separate settings; there is now one, so the
   * two names are kept because the two jobs are still different, and both
   * read the same number.
   */
  const g = realRate(s.growth_after, s.inflation);
  const r = g;

  const M = monthsToExit(s);
  const yearsToExit = M / 12;

  // The one what-if that moves money between the two pots.
  const shift = s.rebalance || 0;

  // Annual saving accrues for as long as you keep working, so a later exit
  // adds both compounding and contributions.
  const pensionContrib = s.pension_per_year * yearsToExit + shift;
  const cashSaved = savingPerYear(s) * yearsToExit - shift;

  // Balances at the moment you stop working. Regular saving is assumed to
  // arrive evenly over the period, so it earns roughly half the growth.
  let bridge0 =
    reachableNow(s) * Math.pow(1 + g, yearsToExit) + cashSaved * (1 + g * yearsToExit * 0.5);

  const pension0 =
    s.pension_now * Math.pow(1 + g, yearsToExit) +
    pensionContrib * (1 + g * yearsToExit * 0.5);

  /*
   * The mortgage, read off its own schedule.
   *
   * `mortgageSchedule` does the amortisation once, in nominal money, and
   * hands back what each year costs in today's money. The projection just
   * looks the year up. This used to be rebuilt inside the drawdown loop,
   * which meant the years before you stop were amortised in one place and
   * the years after in another, and neither of them knew the term.
   */
  const mortgage = mortgageSchedule(s);
  const mortgageClearAge = mortgage.clearAge;
  const mortgageInterest = mortgage.interest;

  /*
   * An offset earns the mortgage rate by avoiding it and earns nothing in the
   * market, and both halves have to be in the model or the lever is free
   * money. The interest it saves is already in the schedule above; this is
   * the other side of it, the growth given up on money parked against the
   * debt during the years you were still working.
   */
  const offsetHeld = Math.max(0, s.mortgage_offset);
  const owingAt = (age: number) =>
    mortgage.clearAge === null || age < mortgage.clearAge ? offsetHeld : 0;

  /*
   * The mortgage before you stop is NOT charged here, and that is deliberate.
   *
   * It was, briefly, on the reasoning that a £420,000 debt cleared the year
   * before you retire cannot cost the plan nothing. But it does cost the plan
   * nothing, because the money that clears it is a salary this model does not
   * hold either. While you are working the mortgage comes out of earnings,
   * and the saving figure you type is what is left after paying it. Deducting
   * it from the pot as well counts it twice.
   *
   * The two absences cancel exactly, which is why the years before you stop
   * can ignore both. After you stop there is no salary, so the payment goes
   * on top of spending, and the drawdown loop does that.
   *
   * The one thing this cannot see is overpaying a mortgage out of savings
   * rather than out of income. That stays parked, and the assumption that
   * your saving is net of the mortgage is stated on the How it works panel
   * rather than left for someone to discover.
   */
  let offsetForgone = 0;
  for (let i = 0; i < Math.floor(yearsToExit); i++) {
    if (owingAt(s.current_age + i) <= 0) continue;
    offsetForgone += offsetHeld * g * Math.pow(1 + g, Math.max(0, Math.floor(yearsToExit) - i - 1));
  }
  bridge0 = Math.max(0, bridge0 - offsetForgone);

  // Read after the offset charge above, or it reports a pot that never existed.
  const total0 = bridge0 + pension0;

  let liquid = bridge0;
  let pension = pension0;
  const rows: YearRow[] = [];

  const taxRate = Math.max(0, s.tax_rate) / 100;
  const allowance = Math.max(0, s.tax_allowance);
  const taxFree = Math.min(1, Math.max(0, s.pension_tax_free_pct / 100));

  /** Tax due on a year's taxable income. */
  const taxOn = (taxable: number) => taxRate * Math.max(0, taxable - allowance);

  /*
   * Capital gains on money sold from a taxable account.
   *
   * Only the gain is taxed, and only above an annual exemption, so a general
   * account sits between an ISA (nothing) and a pension (income tax on most
   * of it). Everything outside the pension used to be treated as free, which
   * understated tax through the bridge years for anyone holding more than an
   * ISA's worth.
   *
   * The share of a holding that is gain rather than original capital is the
   * one number nobody can answer about themselves, so today's share is
   * assumed and stated rather than asked for. From there it is tracked, not
   * assumed again.
   *
   * That distinction is the whole of Bed and ISA. Held as a fixed percentage,
   * moving money into a wrapper only relabelled a balance and was worth
   * nothing, because the gain on what stayed behind never grew. Carrying the
   * cost basis instead lets the gain build as the holding grows, so taking
   * money out of its way genuinely stops it building, which is the actual
   * prize and the reason anyone does this.
   */
  const cgtRate = Math.max(0, s.cgt_rate) / 100;
  const cgtFree = Math.max(0, s.cgt_allowance);
  const isaAllowance = Math.max(0, s.isa_allowance);

  /*
   * The taxable pot is carried as a live balance inside `liquid`, not as a
   * fixed share of it. It grows with the rest, shrinks as it is spent, and
   * shrinks again every year as money is moved into the ISA.
   *
   * `taxableBasis` is what was paid for it. The difference between the two is
   * the unrealised gain, and the ratio between them is what a sale realises.
   *
   * Two sources. What you already hold, which arrives at the exit date having
   * grown and so carrying more gain than it does today. And whatever share of
   * new saving you direct into a general account, which arrives at cost,
   * because money has no gain on the day you pay it in.
   */
  const heldTaxable = Math.max(0, s.gia_now);
  const savingTaxShare = savingTaxableShare(s);
  const newTaxableIn = Math.max(0, cashSaved) * savingTaxShare;
  const newTaxableValue = newTaxableIn * (1 + g * yearsToExit * 0.5);

  let taxablePot = Math.min(
    heldTaxable * Math.pow(1 + g, yearsToExit) + newTaxableValue,
    bridge0,
  );
  let taxableBasis = Math.min(
    heldTaxable * (1 - Math.min(1, Math.max(0, s.assumed_gain_pct / 100))) + newTaxableIn,
    taxablePot,
  );

  /** How much of the taxable pot is profit right now, 0 to 1. */
  const gainFraction = () =>
    taxablePot > 0 ? Math.min(1, Math.max(0, (taxablePot - taxableBasis) / taxablePot)) : 0;

  /** Sell `amount` of market value out of the taxable pot, keeping basis in step. */
  const sellTaxable = (amount: number) => {
    if (amount <= 0 || taxablePot <= 0) return;
    const share = Math.min(1, amount / taxablePot);
    taxableBasis -= taxableBasis * share;
    taxablePot -= taxablePot * share;
  };

  /** Gross to sell so `net` lands, given the exemption still unused. */
  const grossUpSale = (net: number, gainPerPound: number, exemptLeft: number) => {
    if (cgtRate <= 0 || gainPerPound <= 0) return net;
    if (net * gainPerPound <= exemptLeft) return net;
    const denom = 1 - cgtRate * gainPerPound;
    if (denom <= 0) return net;
    const untaxed = exemptLeft / gainPerPound;
    return untaxed + (net - untaxed) / denom;
  };

  let yearIndex = 0;
  for (let age = s.exit_age; age <= s.plan_to; age++) {
    // This year's return. Everything that grows uses the same one.
    const yr = path ? path[yearIndex] ?? r : r;
    yearIndex++;

    const start = liquid;

    // Money parked against the mortgage earns nothing while the debt lives.
    const offsetNow = Math.min(owingAt(age), Math.max(0, start));

    // Zero unless the plan explicitly includes work income. Proper FIRE, with
    // no earnings at all, is the baseline rather than something assumed for you.
    const earnings = age <= s.earn_until_age ? s.earnings_per_year : 0;
    const statePen = age >= s.state_pen_age ? s.state_pension : 0;

    /*
     * Spending, plus whatever the mortgage costs this year.
     *
     * The payment now sits on top of your spending rather than being carved
     * out of it. Carving it out meant a payment larger than your spending
     * left nothing at all to live on, and once the payment became a figure
     * the tool calculates there was no way to keep the two in agreement.
     */
    const mortgagePaid = mortgage.realCost[age - s.current_age] ?? 0;
    const payoff = 0;
    const spend = Math.max(0, s.annual_spend) + mortgagePaid;

    // Growth only applies to money you actually have. Applying it to a
    // shortfall would compound the debt and make better markets look worse.
    //
    // And not to money sitting in an offset account, which is the price of
    // the interest it saves above.
    let tax = 0;
    const growth = start > 0 ? Math.max(0, start - offsetNow) * yr : 0;
    liquid = start + growth;
    if (pension > 0) pension = pension * (1 + yr);
    // The taxable holding rides the same return as the rest of the pot. The
    // basis does not move, so every year of growth is a year of gain built up
    // and waiting to be taxed. That accumulation is what sheltering escapes.
    if (taxablePot > 0) {
      const grown = Math.min(taxablePot * (1 + yr), Math.max(0, liquid));
      taxableBasis = Math.min(taxableBasis, grown);
      taxablePot = grown;
    }

    // There is one gains exemption a year and everything that sells draws on
    // it. Spending has first claim, because you have to eat; sheltering takes
    // what is left. See the transfer below for why that order matters.
    let exemptLeft = cgtFree;

    // 1. Income arrives and is taxed.
    const otherTaxable = earnings + statePen;
    tax += taxOn(otherTaxable);
    let need = spend - (otherTaxable - taxOn(otherTaxable));

    // 2. Money outside the pension is spent next. Selling is free from an
    //    ISA and realises a gain from a taxable account, in proportion to
    //    how much of the pot is still unsheltered.
    if (need > 0 && liquid > 0) {
      const gainPerPound = (taxablePot / liquid) * gainFraction();
      const wanted = grossUpSale(need, gainPerPound, exemptLeft);
      const take = Math.min(liquid, wanted);
      const gains = cgtRate * Math.max(0, take * gainPerPound - exemptLeft);
      exemptLeft = Math.max(0, exemptLeft - take * gainPerPound);
      sellTaxable(take * (taxablePot / liquid));
      liquid -= take;
      tax += gains;
      need -= take - gains;
      if (Math.abs(need) < 1e-6) need = 0;
    }

    /*
     * Bed and ISA. Sell out of the taxable account and rebuy inside the
     * wrapper, so what moves is sheltered from every year after this one.
     *
     * Capped three ways: the yearly subscription limit, what is left in the
     * taxable account, and the gain the exemption has left over. Two of those
     * were wrong before.
     *
     * Moving the full subscription limit realises far more gain than the
     * exemption covers, so it pays tax now to avoid tax later, and over a long
     * plan that is the wrong way round. Move only what is free.
     *
     * And this ran ahead of the spending sale, so it took first claim on the
     * exemption and left the sale you cannot avoid to be taxed from the first
     * pound. That cost more in the early years than it saved in the late ones,
     * and the difference compounded for the rest of the plan: sheltering came
     * out £13,000 behind over fifty years while appearing to save tax. Running
     * it after the sale, on the leftover, makes it free by construction and so
     * never worse than not doing it.
     */
    if (isaAllowance > 0 && taxablePot > 0 && exemptLeft > 0) {
      const g = gainFraction();
      const freeToMove = g > 0 ? exemptLeft / g : taxablePot;
      const moved = Math.min(isaAllowance, taxablePot, freeToMove);
      exemptLeft = Math.max(0, exemptLeft - moved * g);
      sellTaxable(moved);
    }

    // 3. The pension last, and only once it has unlocked. Grossed up so that
    //    what lands after tax is what was actually needed.
    let fromPension = 0;
    if (need > 0 && age >= s.pension_access_age && pension > 0) {
      const taxableShare = 1 - taxFree;

      // Solved in two pieces, because tax starts partway through the
      // withdrawal. The first slice fits under what is left of the allowance
      // and is untaxed; everything after it is taxed at the margin.
      //
      // Deciding taxed-or-not from the untaxed guess and then solving as if
      // the whole withdrawal were taxed left a residue at the boundary. A
      // fraction of a penny was enough to push the balance below zero and have
      // the plan reported as running out with a full pension still sitting
      // there, which also made feasibility non-monotonic in spend.
      const untaxedGross =
        taxableShare > 0 ? Math.max(0, allowance - otherTaxable) / taxableShare : Infinity;

      let gross: number;
      if (need <= untaxedGross) {
        gross = need;
      } else {
        const denom = 1 - taxRate * taxableShare;
        gross = denom > 0 ? untaxedGross + (need - untaxedGross) / denom : pension;
      }

      fromPension = Math.min(pension, Math.max(0, gross));
      pension -= fromPension;

      const incomeTaxNow = taxOn(otherTaxable + fromPension * taxableShare);
      const extra = incomeTaxNow - taxOn(otherTaxable);
      need -= fromPension - extra;
      tax += extra;

      // Close out anything left from floating point.
      if (Math.abs(need) < 1e-6) need = 0;
    }

    // 4. Anything still unmet is a shortfall, and shows as a negative balance.
    if (need > 0) liquid -= need;

    rows.push({
      age, start, earnings, statePen, spend, growth,
      fromPension, tax, payoff,
      end: liquid,
      pensionEnd: pension,
    });
  }

  // A pound of tolerance. Balances are carried in real terms over sixty
  // years, so the last decimal place is noise, not a shortfall.
  const RUIN = -1;

  let runsOutAge: number | null = null;
  for (const row of rows) {
    if (row.end < RUIN) {
      runsOutAge = row.age;
      break;
    }
  }

  // The low point across the bridge years. If you stop working after your
  // pension is already accessible there is no bridge, so fall back to the
  // overall minimum rather than reporting nothing.
  const bridgeRows = rows.filter((row) => row.age <= s.pension_access_age);
  const searchRows = bridgeRows.length ? bridgeRows : rows;

  let low = { val: Infinity, age: s.exit_age };
  for (const row of searchRows) {
    if (row.end < low.val) low = { val: row.end, age: row.age };
  }
  if (!isFinite(low.val)) {
    low = { val: rows.length ? rows[0].end : bridge0, age: s.exit_age };
  }

  const last = rows[rows.length - 1];
  const endBal = last ? last.end + last.pensionEnd : bridge0;

  return {
    bridge0,
    pension0,
    total0,
    rows,
    runsOutAge,
    low,
    endBal,
    mortgageClearAge,
    mortgageInterest,
    monthsLeft: M,
  };
}

/** A plan works if it never goes negative, including through the bridge. */
export function feasible(res: Projection): boolean {
  return res.runsOutAge === null && res.low.val >= -1;
}

/**
 * Terminal wealth expressed as years of spending, which is the only way it
 * means anything.
 *
 * A surplus compounding for fifty years produces numbers like £16m, which are
 * arithmetically correct and completely useless as a headline: they say more
 * about the return assumption than about the plan. "Forty years of spending
 * spare" is the same fact in a form you can actually judge.
 */
export function spareYears(res: Projection, annualSpend: number): number {
  if (annualSpend <= 0) return Infinity;
  return res.endBal / annualSpend;
}

/** True when the plan involves no work income at all after stopping. */
export function isFullFire(s: Settings): boolean {
  return s.earnings_per_year <= 0;
}
