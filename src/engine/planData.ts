import type { Projection, Settings } from './types';
import { mortgageSchedule, mortgageCostAt, reachableNow, savingPerYear, realRate } from './compute';

/**
 * Everything a downloaded plan contains, assembled once.
 *
 * There are two file formats and they were never going to stay in step if
 * each one listed the figures itself. A setting added to the spreadsheet and
 * forgotten in the PDF gives two documents about the same plan that disagree,
 * which is worse than only having one of them. So the content is decided
 * here, in one list, and the exporters only decide how it looks.
 *
 * Everything is in today's money. Nothing is formatted: values are numbers
 * and the unit is a separate field, because a spreadsheet cannot add up
 * "£26,000" and the PDF would rather do its own formatting anyway.
 */

export interface Fact {
  k: string;
  v: number | string;
  /** Empty for things that are not a quantity, like "never". */
  unit: string;
}

export interface PlanData {
  title: string;
  /** ISO date, so a file found later says when it was true. */
  exported: string;
  inputs: Fact[];
  derived: Fact[];
  columns: string[];
  rows: (number | string)[][];
}

const r0 = (n: number) => Math.round(n);

export function planData(s: Settings, res: Projection, name: string): PlanData {
  const m = mortgageSchedule(s);

  const inputs: Fact[] = [
    { k: 'Age now', v: s.current_age, unit: 'years' },
    { k: 'Age you stop', v: s.exit_age, unit: 'years' },
    { k: 'Money has to last to', v: s.plan_to, unit: 'years' },
    { k: 'In an ISA', v: s.isa_now, unit: 'GBP' },
    { k: 'In a general account', v: s.gia_now, unit: 'GBP' },
    { k: 'Other', v: s.other_now, unit: 'GBP' },
    { k: 'In a pension', v: s.pension_now, unit: 'GBP' },
    { k: 'Everything, today', v: reachableNow(s) + s.pension_now, unit: 'GBP' },
    { k: 'Into an ISA each year', v: s.isa_per_year, unit: 'GBP' },
    { k: 'Into a general account each year', v: s.gia_per_year, unit: 'GBP' },
    { k: 'Into a pension each year', v: s.pension_per_year, unit: 'GBP' },
    { k: 'Saved each year, all of it', v: savingPerYear(s) + s.pension_per_year, unit: 'GBP' },
    { k: 'Spending, not counting the mortgage', v: s.annual_spend, unit: 'GBP' },
    { k: 'Growth', v: s.growth_after, unit: '% before inflation' },
    { k: 'Inflation', v: s.inflation, unit: '%' },
    {
      k: 'Growth, real',
      v: +(realRate(s.growth_after, s.inflation) * 100).toFixed(3),
      unit: '%',
    },
    { k: 'Work income after stopping', v: s.earnings_per_year, unit: 'GBP' },
    { k: 'Earn until', v: s.earn_until_age, unit: 'years' },
    { k: 'State pension', v: s.state_pension, unit: 'GBP' },
    { k: 'State pension from', v: s.state_pen_age, unit: 'years' },
    { k: 'Pension unlocks at', v: s.pension_access_age, unit: 'years' },
    { k: 'Mortgage owed', v: s.mortgage_balance, unit: 'GBP' },
    { k: 'Mortgage rate', v: s.mortgage_rate, unit: '%' },
    { k: 'Mortgage paid off by', v: s.mortgage_paid_by, unit: 'years' },
    { k: 'Offset fund', v: s.mortgage_offset, unit: 'GBP' },
    { k: 'Mortgage payment', v: r0(m.payment), unit: 'GBP a year' },
    { k: 'Mortgage interest, total', v: r0(m.interest), unit: 'GBP' },
    { k: 'Income tax rate', v: s.tax_rate, unit: '%' },
    { k: 'Income tax free each year', v: s.tax_allowance, unit: 'GBP' },
    { k: 'Pension tax free share', v: s.pension_tax_free_pct, unit: '%' },
    { k: 'Capital gains rate', v: s.cgt_rate, unit: '%' },
    { k: 'Capital gains free each year', v: s.cgt_allowance, unit: 'GBP' },
    { k: 'Profit so far, general account', v: s.assumed_gain_pct, unit: '%' },
    { k: 'Moved into an ISA each year', v: s.isa_allowance, unit: 'GBP' },
  ];

  /*
   * The mortgage figure quoted here is the cost in the first year of the
   * plan, not the payment, for the same reason the screen quotes it that way:
   * a payment is a rate with no end date on it, and a mortgage has one.
   */
  const derived: Fact[] = [
    { k: 'Spending in the first year, mortgage included', v: r0(s.annual_spend + mortgageCostAt(s, s.exit_age)), unit: 'GBP' },
    { k: 'Reachable when you stop', v: r0(res.bridge0), unit: 'GBP' },
    { k: 'Pension when you stop', v: r0(res.pension0), unit: 'GBP' },
    { k: 'Everything when you stop', v: r0(res.total0), unit: 'GBP' },
    { k: 'Runs dry at', v: res.runsOutAge ?? 'never', unit: res.runsOutAge === null ? '' : 'years' },
    { k: 'Lowest before the pension opens', v: r0(res.low.val), unit: 'GBP' },
    { k: 'At age', v: res.low.age, unit: 'years' },
    { k: 'Left at the end', v: r0(res.endBal), unit: 'GBP' },
    {
      k: 'Mortgage paid off at',
      v: res.mortgageClearAge ?? 'not within the plan',
      unit: res.mortgageClearAge === null ? '' : 'years',
    },
  ];

  const columns = [
    'Age',
    'Reachable at start',
    'Work income',
    'State pension',
    'Spending',
    'Growth',
    'From pension',
    'Tax',
    'Reachable at end',
    'Pension at end',
    'Total',
  ];

  const rows = res.rows.map((r) => [
    r.age,
    r0(r.start),
    r0(r.earnings),
    r0(r.statePen),
    r0(r.spend),
    r0(r.growth),
    r0(r.fromPension),
    r0(r.tax),
    r0(r.end),
    r0(r.pensionEnd),
    r0(r.end + r.pensionEnd),
  ]);

  return {
    title: name,
    exported: new Date().toISOString().slice(0, 10),
    inputs,
    derived,
    columns,
    rows,
  };
}

/** Hand the browser a file. Nothing leaves the machine. */
export function download(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A plan name that is safe as a filename on every system. */
export function safeName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return clean || 'plan';
}
