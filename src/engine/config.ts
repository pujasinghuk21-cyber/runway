import type { Settings, SettingsKey } from './types';
import { fmtMoney } from './format';

/* ── the UK ────────────────────────────────────────────────────────────────
   One jurisdiction, not six.

   This carried presets for the UK, US, Ireland, Australia, Canada and a
   generic "somewhere else", each with a state pension, an access age, tax
   rates and contribution limits. Only the UK row was ever checked against the
   real rules. Ireland and Canada cap pension contributions as a percentage of
   earnings rather than a flat sum, so those two were quietly wrong, and a
   plausible wrong number in a retirement calculator is worse than no number.

   Everything below is still editable. These are starting points, not law, and
   they go out of date every April.
   ──────────────────────────────────────────────────────────────────────── */

export const UK = {
  name: 'United Kingdom',
  currency: 'GBP',
  stateName: 'State pension',
  state_pen_age: 67,
  pension_access_age: 57,
  state_pension: 12_000,
  tax_rate: 20,
  tax_allowance: 12_570,
  pension_tax_free_pct: 25,
  pension_annual_allowance: 60_000,
  cgt_rate: 24,
  cgt_allowance: 3000,
  isa_allowance: 20000,
} as const;

/* ── starting figures ──────────────────────────────────────────────────────
   Deliberately generic. Nothing here describes any particular person. These
   are the values a brand-new browser starts with, and the setup flow replaces
   the ones that matter within about thirty seconds.

   Rules for anything added here:
     - No personal balances. Round, obviously-illustrative numbers only.
     - No assumed income. Full FIRE is the baseline.
     - Anything jurisdiction-specific gets a comment saying so.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * What the thing is called.
 *
 * "Freedom Plan" was the working name and it does not survive its own worst
 * output. Read it next to the bad answer: "Freedom Plan. These numbers don't
 * reach, at any age." That grades a person in the moment it tells them no.
 * It also defines the good life as not working, which is one community's
 * politics shipped as a default, and plenty of people planning an ordinary
 * retirement do not share it.
 *
 * The bar it has to clear: read it next to the worst thing the product can
 * say. "These numbers don't reach, at any age." A name that grades the reader
 * in that moment is the wrong name.
 *
 * Runway is what pilots and founders call the distance you have before you
 * run out. It clears that bar, and unlike a coined name it also says what
 * the thing measures, which matters for something people will arrive at by
 * searching rather than by being told.
 *
 * One constant, so changing your mind costs one line.
 */
export const APP_NAME = 'Runway';

/** What it is, in one line, for anyone who has just arrived. */
/*
 * What it does, said as a test rather than as a discovery.
 *
 * This read "How long your money lasts after you stop working", which claims
 * to answer a question the very first field then asks you: the third box on
 * the page was labelled "Money lasts to" and wanted a number. The tool does
 * not find that number, you set it, and the tool tells you whether the plan
 * survives it. Promising the one and delivering the other is the kind of gap
 * that makes people distrust everything else on the page.
 *
 * "Check" is the honest verb, and the rest of the line is unchanged so the
 * phrase somebody would actually search for is still in it.
 */
export const APP_TAGLINE = 'Check whether your money lasts after you stop working';

export const DEFAULTS: Settings = {
  /*
   * The example plan, and it works.
   *
   * It used to be someone stopping at 50 on £150,000 with nothing going in,
   * which ran dry at 55 and ended £744,701 in the hole. A first screen that
   * says no before you have typed anything teaches nothing except that the
   * tool is bleak.
   *
   * This one holds: £110,000 today, £12,000 a year going in, stopping at 60
   * on £35,000. Ordinary numbers rather than aspirational ones, with about
   * £9,000 a year of room to spare, so the answer is yes without being so
   * comfortable that nothing on the page has anything to say.
   */

  // Who and when
  current_age: 40,
  exit_age: 60,
  plan_to: 90,

  // What you have today
  isa_now: 40_000,
  gia_now: 10_000,
  other_now: 0,
  pension_now: 60_000,

  // What you'll add before you stop, per year.
  isa_per_year: 6_000,
  gia_per_year: 0,
  pension_per_year: 6_000,

  // The drawdown
  growth_after: 7,
  inflation: 2.5,
  volatility: 15,
  annual_spend: 35_000,

  // Income after stopping. Work income is zero on purpose: proper FIRE means
  // no work income, and the tool should never quietly assume you'll pick up a
  // bit of work. The state pension is not an assumption, it is a rule, so it
  // is filled in rather than left at nothing for you to discover.
  earnings_per_year: 0,
  earn_until_age: 60,
  state_pension: UK.state_pension,
  state_pen_age: UK.state_pen_age,
  pension_access_age: UK.pension_access_age,

  // Tax. UK rules, all editable in the tax section.
  tax_rate: UK.tax_rate,
  tax_allowance: UK.tax_allowance,
  pension_tax_free_pct: UK.pension_tax_free_pct,
  pension_annual_allowance: UK.pension_annual_allowance,
  cgt_rate: UK.cgt_rate,
  cgt_allowance: UK.cgt_allowance,
  assumed_gain_pct: 50,
  isa_allowance: UK.isa_allowance,

  // Housing
  mortgage_paid_by: 0,
  mortgage_rate: 4.5,
  mortgage_offset: 0,

  // What-ifs
  rebalance: 0,
  mortgage_balance: 0,
};

// There used to be a "floor" here: a stay-above target for the pot on the day
// you stop, defaulted to 25x annual spend (the 4% rule). Two problems. It was
// never rendered anywhere, so it was a dead lever. And the 4% rule assumes you
// live off returns and never touch the capital, which means dying with the
// whole pot intact. The question this tool answers is the opposite one: how
// much can you spend and still make it to the end. That is "Most you could
// spend", which solves for landing near zero at your plan-to age.


/* ── levers ────────────────────────────────────────────────────────────── */

// 'age' is a stepper, not a slider. An age is a small integer you already
// know, so dragging is the wrong gesture and it eats a whole row to express a
// range of twenty. There are seven of them.
export type LeverKind = 'money' | 'pct' | 'age' | 'toggle';

/** Bounds can depend on the rest of the plan. You shouldn't be able to set
 *  "earn until 45" when you don't stop working until 50. */
type Bound = number | ((s: Settings) => number);

export interface Lever {
  k: SettingsKey;
  label: string | ((s: Settings) => string);
  /** A function when the hint needs to show the user their own arithmetic. */
  hint?: string | ((s: Settings) => string);
  kind: LeverKind;
  min?: Bound;
  max?: Bound;
  step?: number;
  /** Greyed out and ignored unless this other setting is truthy. */
  dep?: SettingsKey;
  /**
   * Show the hint even where the rail hides hints on hover.
   *
   * For the handful where getting it wrong changes the answer rather than
   * merely leaving you unsure. Hover does not exist on a phone, so putting
   * "no capital gains tax here" behind one meant someone could file property
   * equity under Other, make their plan materially rosier, and never be told.
   *
   * The rule: if the wrong reading changes the number, it cannot hide.
   */
  alwaysHint?: boolean;
  /**
   * What is wrong with this value, in a sentence, or null when nothing is.
   *
   * Shown under the field in the warning colour and never hidden behind a
   * hover, because a message you have to go looking for is not a warning.
   *
   * These are for inputs that contradict each other rather than inputs that
   * are merely bold. Nobody should be stopped from planning on a 15% return;
   * everybody should be stopped from paying a mortgage they do not owe.
   */
  problem?: (s: Settings) => string | null;
}

export interface LeverGroup {
  id: string;
  title: string;
  note: string;
  accent?: boolean;
  /**
   * Kept out of the levers rail.
   *
   * For settings that are facts of where you live rather than choices you
   * make. Asking someone for their allowance, their marginal rate and the
   * taxable share of a pension withdrawal is asking three questions to get one
   * answer they already expected the tool to know. The country preset fills
   * them in and the consequence is reported under the chart.
   *
   * Still reachable in two places: the full edit panel, and its own section
   * under the rail (see TaxCard), for anyone who wants to model it their way.
   */
  railOnly?: false;
  hiddenFromRail?: boolean;
  items: Lever[];
}

/**
 * A slider ceiling that always leaves somewhere to drag to.
 *
 * Twice the current value, floored at a sensible default and rounded up, so
 * the handle never sits pinned against the right-hand end.
 */
function headroom(current: number, floor: number): number {
  const target = Math.max(floor, current * 2);
  const mag = Math.pow(10, Math.floor(Math.log10(target)) - 1);
  return Math.ceil(target / mag) * mag;
}

/**
 * What a yearly amount adds up to before you stop.
 *
 * Silent when there is a year or less to go, because then the total is the
 * same number as the yearly figure and printing it twice says nothing.
 */
function yearsHint(s: Settings, perYear: number, fallback: string): string {
  const years = Math.max(0, s.exit_age - s.current_age);
  if (perYear <= 0) return fallback;
  if (years < 2) return fallback;
  return `${fmtMoney(perYear * years)} over ${years} years`;
}

export function resolveBound(b: Bound | undefined, s: Settings, fallback: number): number {
  if (b === undefined) return fallback;
  return typeof b === 'function' ? b(s) : b;
}

export function resolveHint(h: Lever['hint'], s: Settings): string {
  if (!h) return '';
  return typeof h === 'function' ? h(s) : h;
}

export function resolveLabel(l: Lever['label'], s: Settings): string {
  return typeof l === 'function' ? l(s) : l;
}

/*
 * The three dates the whole plan hangs on, kept out of the groups.
 *
 * They were scattered: your age and your exit age in one collapsible section,
 * how long the money has to last in another. Every other number in the tool
 * only means something once these three are set, and two of them were behind
 * a chevron.
 *
 * They sit across the top of the rail instead, always open, in the order you
 * would say them out loud.
 */
export const TIMELINE: Lever[] = [
  { k: 'current_age', label: 'Your age', kind: 'age', min: 16, max: 100, step: 1 },
  {
    k: 'exit_age',
    label: 'Retire at',
    kind: 'age',
    min: (s) => s.current_age,
    max: (s) => Math.min(85, s.plan_to - 1),
    step: 1,
  },
  {
    k: 'plan_to',
    // A horizon you set, not an answer you are given. Labelled "Money lasts
    // to", it read as an output sitting in a row of inputs, and it said the
    // same thing as the strapline at the top of the page.
    label: 'Plan until',
    problem: (s) => (s.plan_to <= s.exit_age ? 'Has to be after you retire.' : null),
    kind: 'age',
    min: (s) => Math.max(s.exit_age + 1, 60),
    max: 110,
    step: 1,
  },
];

/** ", 1 year" or ", 10 years". Nothing at all when there is no span to name. */
const span = (years: number): string => {
  const n = Math.max(0, Math.round(years));
  if (n <= 0) return '';
  return n === 1 ? ', 1 year' : `, ${n} years`;
};

export const GROUPS: LeverGroup[] = [
  /*
   * One question per group, running down the timeline: what you have, what
   * you add, then what goes out and what comes in once you have stopped.
   *
   * There used to be a "the ones that move it most" group on top. It was a
   * favourites shortcut rather than a category: it pulled spend, growth and
   * exit age out of the places they belong, left the other groups holding the
   * leftovers, and claimed a ranking nothing actually computed. Quick access
   * to those levers is the Edit button on the chart, which is where you are
   * looking when you want them.
   */
  /*
   * What you have, back in the rail.
   *
   * These lived in a read-only "Your details" card above, on the theory that
   * balances are answers you gave rather than levers you drag, and everything
   * else was a lever. That line did not survive contact: the rail now holds
   * your spending, your mortgage, your saving and your growth rate, which are
   * every bit as much answers about your life as your ISA balance is.
   *
   * So the column is one form. Two panels of numbers about the same person,
   * one of them editable in place and the other only through a separate
   * screen, was a distinction nobody could see the point of.
   */
  /*
   * Three groups, named on one axis: when.
   *
   * They used to be "What you have", "Until you stop", "What goes out" and
   * "What comes in", which is three headings about what a number is and one
   * about when it happens. Reading down the rail you kept changing frame, and
   * fields landed in the wrong place because of it: how long the money has to
   * last was filed under money going out, and the growth rate after you stop
   * was filed under money coming in.
   *
   * A plan has three moments. What you hold now, what you add until you stop,
   * and what happens after. Every field belongs to exactly one of them.
   */
  {
    id: 'today',
    title: 'What you have today',
    note: '',
    items: [
      {
        k: 'isa_now',
        label: 'In an ISA',
        hint: 'tax free, and you can reach it any time',
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.isa_now, 200_000),
        step: 1_000,
      },
      {
        k: 'gia_now',
        label: 'In a general account',
        hint: 'reachable any time, and gains are taxed when you sell',
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.gia_now, 200_000),
        step: 1_000,
      },
      {
        k: 'other_now',
        alwaysHint: true,
        label: 'Other',
        hint: 'cash, premium bonds, savings. No capital gains tax here, so keep anything taxable in the general account.',
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.other_now, 100_000),
        step: 1_000,
      },
      {
        k: 'pension_now',
        label: 'In a pension',
        hint: (s) => `locked until ${s.pension_access_age}`,
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.pension_now, 200_000),
        step: 1_000,
      },
    ],
  },
  {
    id: 'before',
    title: 'Between now and stopping',
    note: '',
    items: [
      {
        k: 'isa_per_year',
        problem: (s) =>
          s.isa_allowance > 0 && s.isa_per_year > s.isa_allowance
            ? `Over the ${fmtMoney(s.isa_allowance)} a year you’re allowed to put in.`
            : null,
        label: 'Into an ISA each year',
        hint: (s) => yearsHint(s, s.isa_per_year, 'tax free, and you can reach it any time'),
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.isa_per_year, 20_000),
        step: 500,
      },
      {
        k: 'gia_per_year',
        label: 'Into a general account each year',
        hint: (s) => yearsHint(s, s.gia_per_year, 'reachable any time, and gains are taxed when you sell'),
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.gia_per_year, 60_000),
        step: 500,
      },
      {
        k: 'pension_per_year',
        problem: (s) =>
          s.pension_annual_allowance > 0 && s.pension_per_year > s.pension_annual_allowance
            ? `Over the ${fmtMoney(s.pension_annual_allowance)} a year limit. Going past it means a tax charge this doesn’t model.`
            : null,
        label: 'You pay into a pension each year',
        hint: (s) => yearsHint(s, s.pension_per_year, 'yours plus employer match'),
        kind: 'money',
        min: 0,
        max: (s) => headroom(s.pension_per_year, 60_000),
        step: 500,
      },
    ],
  },
  {
    id: 'after',
    title: 'Once you’ve stopped',
    note: '',
    items: [
      /*
       * No "after you stop" in these labels. The group is called "Once you've
       * stopped", so a field inside it reading "Work income after you stop"
       * says the same thing twice, an inch apart, and the qualifier stops
       * carrying any information at all.
       */
      { k: 'annual_spend',
        alwaysHint: true, label: 'You spend each year', hint: 'after tax, and not counting the mortgage. That is added on top.', kind: 'money', min: 0, max: (s) => Math.max(80_000, Math.ceil((s.annual_spend * 2) / 10_000) * 10_000), step: 1_000 },
      { k: 'earnings_per_year', label: 'Work income', hint: 'zero if you plan to stop completely', kind: 'money', min: 0, max: 60_000, step: 500 },
      { k: 'earn_until_age', label: 'Earn until age', kind: 'age', min: (s) => s.exit_age, max: (s) => Math.min(85, s.plan_to), step: 1, dep: 'earnings_per_year' },
      { k: 'state_pension', label: (s) => `State pension from ${s.state_pen_age}`, kind: 'money', min: 0, max: (s) => headroom(s.state_pension, 30_000), step: 500 },
    ],
  },
  {
    /*
     * The three rates, together, in their own card.
     *
     * Growth was a row in two different groups, labelled "Growth while you're
     * working" and "Growth once you've stopped", each under a heading that
     * already said when. Inflation, which the whole model runs on, had no
     * field anywhere: the engine used it, the strip printed it, the exports
     * carried it, and there was no way to change it.
     *
     * Hints are hover only. Three permanent lines of explanation under three
     * one-word labels was more copy than the fields it was explaining.
     */
    id: 'growth',
    title: 'Growth and inflation',
    hiddenFromRail: true,
    note: '',
    items: [
      /*
       * One rate, and it says how long it runs for.
       *
       * There were two, one for the years you work and one for the years
       * after. The split existed for people who de-risk at retirement, and it
       * cost more than it bought: two near-identical labels, a second number
       * to reconcile, and "Growth" appearing twice in a rail where the two
       * were eleven fields apart.
       *
       * The span stays, because it is the thing that was actually missing. A
       * rate with no period attached is not a claim you can judge: 15% over
       * one year is a forecast somebody might have evidence for, and 15% over
       * fifty is a fantasy. The label changes as you move your ages, so a
       * number typed for a short horizon cannot quietly become a long one.
       */
      {
        k: 'growth_after',
        label: (s) => `Growth${span(s.plan_to - s.current_age)}`,
        hint: 'what your fund quotes, before inflation',
        kind: 'pct', min: 0, max: 20, step: 0.25,
      },
      {
        k: 'inflation',
        label: 'Inflation',
        hint: 'comes off both, so every figure is in today’s money',
        kind: 'pct', min: 0, max: 12, step: 0.25,
      },
    ],
  },
  {
    id: 'tax',
    title: 'Tax',
    hiddenFromRail: true,
    // Relief on the way in is not here: it changes what a contribution costs
    // you, not the pot you end up with, so it sits with the advice it feeds.
    //
    // The tax-free share is, though. It was pulled out as "statutory, like the
    // access age", which was wrong: the rate below cannot be read without it,
    // because it begs the question of which part of a withdrawal is taxable.
    note: '',
    items: [
      { k: 'tax_allowance', label: 'Tax free income allowance', hint: 'income you can take before paying anything', kind: 'money', min: 0, max: (s) => headroom(s.tax_allowance, 30_000), step: 500 },
      { k: 'tax_rate', label: 'Income tax rate', kind: 'pct', min: 0, max: 60, step: 1 },
      {
        k: 'cgt_rate',
        label: 'Capital gains rate',
        hint: 'on money sold from a taxable account',
        kind: 'pct', min: 0, max: 60, step: 1,
      },
      { k: 'cgt_allowance', label: 'Tax free gains allowance', kind: 'money', min: 0, max: (s) => headroom(s.cgt_allowance, 20_000), step: 250 },
      { k: 'pension_annual_allowance', label: 'Pension contribution limit', hint: 'gross, before relief; zero means no limit', kind: 'money', min: 0, max: (s) => headroom(s.pension_annual_allowance, 100_000), step: 1_000 },
      { k: 'isa_allowance', label: 'Moved into an ISA each year', hint: 'moved from a taxable account into an ISA', kind: 'money', min: 0, max: (s) => headroom(s.isa_allowance, 40_000), step: 1_000 },
      // Today's figure, not a permanent one. The projection carries the cost
      // basis forward from here, so the share that is profit climbs on its own
      // as the holding grows.
      { k: 'assumed_gain_pct', label: 'Profit in your general account', hint: 'the rest is your own money; this share grows on its own from here', kind: 'pct', min: 0, max: 100, step: 5 },
      {
        k: 'pension_tax_free_pct',
        label: 'Tax free share of a pension',
        hint: (s) => {
          const effective = (s.tax_rate * (100 - s.pension_tax_free_pct)) / 100;
          return `so taking ${fmtMoney(1000)} out of the pension costs about ${fmtMoney(
            (1000 * effective) / 100,
          )} in tax, once you’re over the allowance`;
        },
        kind: 'pct', min: 0, max: 100, step: 5,
      },
    ],
  },
  // The what-ifs group lived here: shift-to-pension and clear-the-mortgage.
  // Parked to be rebuilt as its own thing. The settings still exist and the
  // engine still honours them, so nothing is lost by reinstating the group.
];

/* ── stress tests ──────────────────────────────────────────────────────────
   Relative to whatever the user assumes, not to fixed numbers. The old build
   hardcoded 3.5 / 4.5 / 5.5 / 7.0% and a £11,100 side income, which were one
   person's assumptions presented as though they were everyone's.
   ──────────────────────────────────────────────────────────────────────── */

export interface StressTest {
  id: string;
  name: string;
  note: string;
  /** The change this test applies. Empty object means "the plan as it stands". */
  patch: (s: Settings) => Partial<Settings>;
  /** True when the current settings already match this test. */
  isActive: (s: Settings) => boolean;
}

const DOWN = 1.5;
const UP = 1.5;

/*
 * One rate to move now, and it covers the whole plan.
 *
 * When there were two of these, only the one after you stop was patched, so
 * the pot you arrived at the exit age with came out identical under all
 * three views. With a single rate the accumulation and the drawdown are
 * stressed together, which is what a bad decade actually does.
 */
export const STRESS_TESTS: StressTest[] = [
  {
    id: 'poor',
    name: 'Poor markets',
    note: `${DOWN}% below yours`,
    patch: (s) => ({ growth_after: Math.max(0, s.growth_after - DOWN) }),
    isActive: () => false,
  },
  {
    id: 'base',
    name: 'Your assumption',
    note: 'As you have it set',
    patch: () => ({}),
    isActive: () => true,
  },
  {
    id: 'good',
    name: 'Good markets',
    note: `${UP}% above yours`,
    patch: (s) => ({ growth_after: s.growth_after + UP }),
    isActive: () => false,
  },
];

// "Full FIRE" used to sit here as a fourth card. It varied work income, not
// market returns, so it was not comparable to the other three, and because
// zero work income is already the default it usually did nothing when pressed.
// That axis belongs to the earnings lever and to the ranked move that offers
// to strip work income out whenever a plan has any.

/* ── pasted-balance import ─────────────────────────────────────────────── */


/* ── storage keys ──────────────────────────────────────────────────────── */

export const STORE_KEY = 'freedomPlan.settings.v1';
export const SCENARIOS_KEY = 'freedomPlan.scenarios.v1';
export const BASE_KEY = 'freedomPlan.baseline.v1';
export const LOG_KEY = 'freedomPlan.log.v1';
export const SETUP_KEY = 'freedomPlan.setupDone';
/** The plan exactly as it stood when you last saved your details. */

