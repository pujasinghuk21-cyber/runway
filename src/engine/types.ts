/**
 * Every lever in the plan.
 *
 * All money is in today's money (real terms). Growth rates are after
 * inflation, so there is no separate inflation term anywhere and no figure
 * needs mentally discounting.
 *
 * Nothing in here is specific to any one person. The starting values live in
 * config.ts and are deliberately generic; a real plan comes from the setup
 * flow and is saved to the user's own browser.
 */
export interface Settings {
  // Who and when
  /** Age today. The exit date is derived from this, not stored separately. */
  current_age: number;
  /** The age you stop working. */
  exit_age: number;
  /** The age you're planning the money to last to. */
  plan_to: number;

  /*
   * What you have today, one figure per account.
   *
   * This used to be one "invested" total plus a percentage saying how much of
   * it was taxable, and the same trick again for what you save. Two of the
   * four numbers were arithmetic the reader had to do in their head about
   * accounts they can already see the balances of. Naming the accounts asks
   * for what people actually know.
   *
   * The three behave differently and that is the whole reason to separate
   * them. An ISA is tax free. A general account pays capital gains tax on the
   * profit when you sell. A pension is locked until an access age and taxed
   * on the way out, with a tax free share.
   */
  /** Stocks and shares ISA, or the local equivalent. Tax free. */
  isa_now: number;
  /** General investment account. Gains are taxed when you sell. */
  gia_now: number;
  /**
   * Anything else you could spend: cash, premium bonds, a savings account.
   *
   * Treated as reachable and free of capital gains tax, which is right for
   * cash and premium bonds and wrong for property equity or crypto. Money
   * whose gains would be taxed belongs in the general account, where the
   * model will tax it.
   */
  other_now: number;
  /** Locked until your pension access age. */
  pension_now: number;

  // What you'll add before you stop.
  //
  // Both are per year, not lump totals. As totals they did not scale with the
  // exit age, so "work one more year" added a year of compounding but no extra
  // saving, which badly understated what another year of work is worth.
  /** Paid into the ISA each year. */
  isa_per_year: number;
  /** Paid into the general account each year. */
  gia_per_year: number;
  /** Paid into the pension each year. */
  pension_per_year: number;
  /*
   * Growth and inflation, both as your fund and the news quote them.
   *
   * These used to be one number each, already net of inflation, which meant
   * doing a subtraction in your head before you could type anything and left
   * no way to tell a real rate from a headline one by looking. Ask for the
   * two figures people actually know and do the subtraction here.
   *
   * Everything else in the tool stays in today's money. Only these are
   * headline rates.
   */

  // The drawdown
  /** Growth after you stop, before inflation, %. */
  growth_after: number;
  /** What prices do each year, %. Subtracted from both growth rates. */
  inflation: number;
  /**
   * How much the return swings from year to year, as a standard deviation, %.
   *
   * Only the risk view uses it. The projection itself runs the flat rate,
   * because a single line has to be one thing. Global shares have run around
   * 15 to 17% in real terms; a mixed portfolio is lower.
   */
  volatility: number;
  /** What you spend each year. */
  annual_spend: number;

  // Income after stopping
  earnings_per_year: number;
  earn_until_age: number;
  state_pension: number;
  state_pen_age: number;
  pension_access_age: number;

  // Tax.
  //
  // Deliberately a flat effective rate above a tax-free allowance, rather
  // than a bracket table. Brackets are jurisdiction-specific, change every
  // year, and would make the tool wrong everywhere rather than approximately
  // right anywhere. What matters here is the *shape*: pension money is taxed
  // on the way out and money outside it is not, which is the whole reason the
  // split between the two pots changes your answer.
  /** Effective rate on taxable income above the allowance, %. */
  tax_rate: number;
  /** Income you can take each year before any tax, in today's money. */
  tax_allowance: number;
  /** Share of a pension withdrawal that arrives tax free, %. */
  pension_tax_free_pct: number;
  /**
   * Relief on money going into the pension, at your marginal rate, %.
   *
   * This is the other half of the pension trade, and the tool was only
   * modelling one of them. Taxing withdrawals without crediting relief made a
   * pension strictly worse than an ISA in every case: same growth, taxed at
   * the end, and locked until an access age. That is the wrong answer for
   * most people.
   *
   * `pension_per_year` stays gross, the figure a statement shows. Relief is
   * what tells you the take-home cost of putting it there, which is the only
   * way to compare a pound in a pension with a pound anywhere else.
   */
  /** Most you may put into a pension in a year, gross. 0 means no limit. */
  pension_annual_allowance: number;

  /** Capital gains rate on money sold from a taxable account, %. */
  cgt_rate: number;
  /** Gains you can realise each year before any capital gains tax. */
  cgt_allowance: number;
  /** Assumed share of a taxable holding that is gain rather than capital, %. */
  assumed_gain_pct: number;
  /**
   * How much you can move into a tax-free wrapper each year.
   *
   * Bed and ISA: sell from the taxable account and rebuy the same holding
   * inside the ISA, up to the annual subscription limit. The gain is realised
   * on the way through, so the exemption caps how much you can move for
   * nothing, but the money is sheltered from then on. Anyone doing this
   * seriously empties a general account into an ISA over a few years, and the
   * model held the taxable share fixed forever.
   */
  isa_allowance: number;


  // Housing
  /**
   * The age you want the mortgage gone by.
   *
   * An age, not a count of years, because every other date in the plan is one
   * and "18 years left" is a subtraction away from the thing you actually
   * think in. The term falls out of it.
   *
   * It is both the fact and the lever. Set it to what your lender says and it
   * describes the mortgage you have; set it earlier and the payment rises and
   * you watch what that costs. That is the whole of "should I pay it off
   * faster", in one field.
   */
  mortgage_paid_by: number;
  /**
   * Savings held in an account linked to the mortgage.
   *
   * An offset. The linked money earns no interest of its own, but the lender
   * only charges you on the balance less what is sitting there. So it earns
   * the mortgage rate instead of the market, tax free, and unlike paying the
   * mortgage down you can still get at it.
   *
   * Which makes it the third answer to "should I clear it?", and usually the
   * best one when the rate beats your return: same saving, no loss of access.
   */
  mortgage_offset: number;
  /**
   * Interest on the outstanding balance, as your lender quotes it, %.
   *
   * Inflation comes off this the same way it comes off the growth rates, so
   * the three are compared on equal terms. Clearing a mortgage is worth doing
   * when the rate beats what the money would otherwise have earned.
   *
   * There is no end age any more. With a balance, a rate and a payment the
   * year it clears is arithmetic, and asking for it invited it to disagree
   * with the other three.
   */
  mortgage_rate: number;

  // What-ifs, stacked on top of the plan above
  /** Negative keeps money outside the pension, positive moves it in. */
  rebalance: number;
  mortgage_balance: number;
}

export type SettingsKey = keyof Settings;

/** One year of the drawdown. */
export interface YearRow {
  age: number;
  /** Money outside the pension at the start of the year. */
  start: number;
  earnings: number;
  statePen: number;
  /** What you needed to spend, after tax. */
  spend: number;
  growth: number;
  /** Taken out of the pension this year, gross. */
  fromPension: number;
  /** Income tax paid this year. */
  tax: number;
  payoff: number;
  /** Money outside the pension at the end of the year. */
  end: number;
  /** What is left in the pension at the end of the year. */
  pensionEnd: number;
}

export interface Projection {
  /** Money outside the pension at the moment you stop working. */
  bridge0: number;
  /** Pension pot at the moment you stop working. */
  pension0: number;
  total0: number;
  rows: YearRow[];
  /** First age the balance goes negative, or null if it never does. */
  runsOutAge: number | null;
  /** The low point before the pension unlocks, across the bridge years. */
  low: { val: number; age: number };
  endBal: number;
  monthsLeft: number;
  /** Age the mortgage is paid off, or null if there is none or it outlives the plan. */
  mortgageClearAge: number | null;
  /** Every pound of interest the mortgage costs, start to finish. */
  mortgageInterest: number;
}

/** A named, saved plan. Replaces both the old fixed presets and the pin. */
export interface Scenario {
  id: string;
  name: string;
  settings: Settings;
  /** ISO date it was saved. */
  saved: string;
}

export interface LogEntry {
  /** ISO date, YYYY-MM-DD */
  d: string;
  /** Total net worth on that date */
  v: number;
}

/** Money display. Kept minimal: a symbol and a locale for grouping. */
export interface Currency {
  symbol: string;
  locale: string;
  code: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'GBP', symbol: '£', locale: 'en-GB' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'EUR', symbol: '€', locale: 'de-DE' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
];
