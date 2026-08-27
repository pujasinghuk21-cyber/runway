import { useMemo, useState } from 'react';
import {
  AppBar, Box, Button, Card, CardContent, Chip, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, Stack, TextField, ToggleButton, ToggleButtonGroup, Toolbar,
  Typography, useScrollTrigger,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import TargetIcon from '@mui/icons-material/AdjustOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import EventIcon from '@mui/icons-material/EventAvailableOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ChartIcon from '@mui/icons-material/ShowChartOutlined';
import PushPinIcon from '@mui/icons-material/PushPinOutlined';
// Fluent Emoji, MIT licence, vendored in src/assets/emoji. See the LICENCE
// file there. Kept local so the site depends on nobody else's CDN.
import celebrateSticker from './assets/emoji/celebrate.png';
import rocketSticker from './assets/emoji/rocket.png';
import waitSticker from './assets/emoji/wait.png';
import rethinkSticker from './assets/emoji/rethink.png';
import type { Settings, Scenario } from './engine/types';
import {
  APP_NAME, APP_TAGLINE, DEFAULTS, STRESS_TESTS,
  STORE_KEY, SCENARIOS_KEY, BASE_KEY, SETUP_KEY,
} from './engine/config';
import { compute, feasible, spareYears, savingPerYear, mortgageCostAt } from './engine/compute';
import { hasHistory, runHistory, worstPath, safeHistorySpend, SOURCE as HISTORY_SOURCE } from './engine/history';
import {
  earliestExit, maxSpend, enoughToday, extraSavingNeeded, worthToday, spendGain,
  minTrim, minEarnings, bestMix,
} from './engine/solvers';
import {
  fmtMoney, fmtShort,
  setCurrency,
} from './engine/format';
import { useLocalStorage, makeId } from './hooks';
import { Setup } from './components/Setup';
import { Levers } from './components/Levers';
import { MortgageCard } from './components/MortgageCard';
import { GrowthCard } from './components/GrowthCard';
import { TaxCard } from './components/TaxCard';
import { PlansBar } from './components/PlansBar';
import { AssumptionsPage } from './components/AssumptionsPage';
import { RunwayMark, bannerGradient, bannerTint, bannerChipFill } from './components/Brand';
import { BalanceChart } from './components/BalanceChart';
import { YearTable } from './components/YearTable';
import { Assumptions } from './components/Assumptions';
import { EditModal } from './components/EditModal';

/**
 * Describe the margin at the end of the plan without quoting a terminal
 * balance. Compounding a surplus for fifty years produces figures like £16m
 * that are technically right and tell you nothing, so this reports the same
 * fact as years of spending.
 */
function marginPhrase(endBal: number, annualSpend: number): string {
  const years = annualSpend > 0 ? endBal / annualSpend : 0;
  if (years >= 40) return 'far more than you need';
  if (years >= 10) return `${Math.round(years)} years of spending spare`;
  if (years >= 2) return `${Math.round(years)} years spare`;
  if (years >= 0) return 'almost nothing spare';
  return 'short'
}

/**
 * A section's icon, sitting next to its heading.
 *
 * It used to be seated in a white tile with a shadow. That turned a small
 * mark into an object, put a second raised surface inside a card that was
 * already raised, and held the icon 42px away from the words it belongs to.
 * Bare and close is quieter and reads as one thing.
 *
 * Tertiary tone. Never the accent (that is for things you can press) and
 * never full ink, which put decoration at the same weight as the headline
 * beside it.
 */
function SectionIcon({ icon: Icon }: { icon: SvgIconComponent }) {
  return <Icon aria-hidden sx={{ flex: 'none', fontSize: 24, color: 'text.tertiary' }} />;
}

/**
 * Saved plans, filled in the same way as the live one.
 *
 * This was the only stored value read back raw. A plan saved before a setting
 * existed came back without it, and loading that plan put an incomplete
 * Settings into state: the rail then asked a number field to format
 * `undefined` and took the whole page down with it. Anyone with a plan saved
 * before the mortgage rate, the offset, the contribution limit or the saving
 * destination arrived would white-screen the moment they clicked it.
 */
function reviveScenarios(raw: unknown): Scenario[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Scenario[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const settings = reviveSettings(o.settings);
    if (!settings || typeof o.id !== 'string') continue;
    out.push({
      id: o.id,
      name: typeof o.name === 'string' && o.name ? o.name : 'Saved plan',
      settings,
      saved: typeof o.saved === 'string' ? o.saved : '',
    });
  }
  return out;
}

/**
 * Carry old saved plans over to the three account model.
 *
 * Before 27 August 2026 a plan held one `invested_now` total with a
 * `taxable_now` slice of it, and one `saving_per_year` with a
 * `saving_taxable_pct` split. Anyone with a plan saved then would have come
 * back to three empty balances and a projection built on nothing, which is
 * the same class of bug as the missing reviver that white-screened the app.
 *
 * The translation is exact, so a plan reopens showing the same numbers.
 */
function migrateAccounts(o: Record<string, unknown>): void {
  const num = (k: string) => (typeof o[k] === 'number' && isFinite(o[k] as number) ? (o[k] as number) : 0);

  if (o.isa_now === undefined && o.invested_now !== undefined) {
    const invested = num('invested_now');
    const taxable = Math.min(num('taxable_now'), invested);
    o.gia_now = taxable;
    o.isa_now = invested - taxable;
  }
  // A term became an age on 27 August 2026.
  if (o.mortgage_paid_by === undefined && typeof o.mortgage_years === 'number') {
    o.mortgage_paid_by = num('current_age') + (o.mortgage_years as number);
  }
  if (o.isa_per_year === undefined && o.saving_per_year !== undefined) {
    const saved = num('saving_per_year');
    const giaShare = Math.min(100, Math.max(0, num('saving_taxable_pct'))) / 100;
    o.gia_per_year = saved * giaShare;
    o.isa_per_year = saved - saved * giaShare;
  }
}

/** Trust nothing from localStorage; fill gaps from DEFAULTS. */
function reviveSettings(raw: unknown): Settings | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = { ...(raw as Record<string, unknown>) };
  migrateAccounts(o);
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = o[k];
    if (typeof v === 'number' && isFinite(v)) out[k] = v;
  }
  return out;
}

export default function App() {
  const [setupDone, setSetupDone] = useLocalStorage<boolean>(SETUP_KEY, false);
  const [settings, setSettings] = useLocalStorage<Settings>(STORE_KEY, DEFAULTS, reviveSettings);
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>(
    SCENARIOS_KEY,
    [],
    reviveScenarios,
  );

  const [baseline, setBaseline] = useLocalStorage<Settings | null>(BASE_KEY, null, (raw) =>
    raw === null ? null : reviveSettings(raw));

  /**
   * The plan as it stood when you last saved your details.
   *
   * Reset restores this rather than the generic example figures, so it throws
   * away an afternoon of fiddling without throwing away your actual numbers.
   */

  const [open, setOpen] = useState<Record<string, boolean>>({ today: true });
  const [scenarioName, setScenarioName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);

  /** Which saved plan is on screen, and whether it has been changed since. */
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  /** The move under the pointer, drawn over the chart before you commit. */
  /** The move being hovered, by id. Keyed by id because labels rewrite themselves. */
  const [preview, setPreview] = useState<string | null>(null);
  const activePlan = scenarios.find((sc) => sc.id === activePlanId) ?? null;
  const planDirty =
    !!activePlan && JSON.stringify(activePlan.settings) !== JSON.stringify(settings);
  const [assumeOpen, setAssumeOpen] = useState(false);

  /**
   * Which market lens the chart is drawn through. A view, never a change.
   *
   * These used to apply their patch to the plan, and the patch is relative
   * ("your return minus 1.5"), so pressing "Poor markets" three times walked
   * the assumption down to zero and there was no way back to where you
   * started. They are tabs: the plan is untouched and the line is redrawn.
   */
  const [marketView, setMarketView] = useState('base');

  // Currency is module-level in format.ts; keep it in step with stored state.
  // One jurisdiction, so the formatter is set once and never changes.
  setCurrency('GBP');

  /**
   * Every move you have applied, each with the values it overwrote.
   *
   * There used to be one slot, so applying a second move forgot the first and
   * the section offered a single Undo for whichever was most recent. Each move
   * now carries its own undo, restoring only the settings that move touched.
   *
   * Keyed by a fixed id, not by the label. Labels are written from the current
   * plan, so most of them rewrite themselves the instant you apply the move:
   * trim 10% of spending and the row becomes "trim 10% of the new spending",
   * which no longer matches what was recorded and the Undo silently turned
   * back into an Apply. The id is also why an applied move can still be found
   * after it stops being worth suggesting.
   *
   * The label is kept as it read at the time, so an applied row goes on
   * describing what you actually did rather than the next step from here.
   */
  const [applied, setApplied] = useState<
    { id: string; label: string; note?: string; before: Partial<Settings> }[]
  >([]);

  /** Only the keys a patch is about to overwrite, as they stand now. */
  const valuesBefore = (from: Settings, patch: Partial<Settings>): Partial<Settings> =>
    Object.fromEntries(
      (Object.keys(patch) as (keyof Settings)[]).map((k) => [k, from[k]]),
    ) as Partial<Settings>;

  /**
   * Any hand edit drops the undos that recorded the same setting, because
   * their remembered value is no longer what you would want back. Moves that
   * touched other settings survive.
   */
  const patch = (p: Partial<Settings>) => {
    const keys = Object.keys(p);
    setApplied((prev) => prev.filter((a) => !keys.some((k) => k in a.before)));
    setSettings((cur) => ({ ...cur, ...p }));
  };

  const applyMove = (id: string, label: string, p: Partial<Settings>, note?: string) => {
    setApplied((prev) => [
      ...prev.filter((a) => a.id !== id),
      // The values it overwrote are read from what is on screen, not from
      // whatever the change was modelled against, so undo always puts back
      // what was actually there.
      { id, label, note, before: valuesBefore(settings, p) },
    ]);
    setSettings({ ...settings, ...p });
  };

  const undoMove = (id: string) => {
    const entry = applied.find((a) => a.id === id);
    if (!entry) return;
    setApplied((prev) => prev.filter((a) => a.id !== id));
    setSettings((cur) => ({ ...cur, ...entry.before }));
  };

  /* ── derived ─────────────────────────────────────────────────────────── */

  const res = useMemo(() => compute(settings), [settings]);

  /*
   * The fourth market view: what actually happened.
   *
   * The other three are one rate held flat. This one runs the plan through
   * every starting year in a real series and draws the worst of them, which
   * is a date rather than an invented pessimism.
   *
   * It only exists when there is a real series to run. With none, the tab is
   * absent rather than showing something made up.
   */
  const history = useMemo(() => (hasHistory() ? runHistory(settings) : null), [settings]);
  const worstRun = useMemo(() => (hasHistory() ? worstPath(settings) : null), [settings]);
  const historyRes = useMemo(
    () => (worstRun ? compute(settings, worstRun.path) : null),
    [settings, worstRun],
  );

  /*
   * The number that would have worked. Only solved while the tab is open,
   * because it runs the whole plan through every start twenty four times
   * over and nobody looking at the other tabs is asking for it.
   */
  const historySafe = useMemo(
    () => (marketView === 'history' && hasHistory() ? safeHistorySpend(settings, 1) : null),
    [settings, marketView],
  );


  const viewSettings = useMemo<Settings>(() => {
    const test = STRESS_TESTS.find((t) => t.id === marketView);
    return test ? { ...settings, ...test.patch(settings) } : settings;
  }, [settings, marketView]);
  const viewRes = useMemo(
    () => (marketView === 'history' && historyRes ? historyRes : compute(viewSettings)),
    [viewSettings, marketView, historyRes],
  );
  const baseRes = useMemo(() => (baseline ? compute(baseline) : null), [baseline]);

  /**
   * The plan as it stood before anything was applied.
   *
   * Every applied entry remembers the values it overwrote, so putting them
   * all back, newest first, reconstructs where you started. Rolled newest
   * first so that if two changes touched the same setting the earliest
   * recorded value is the one that survives.
   *
   * Drawn under the current line so applying something adds a line rather
   * than replacing one. Without it the plan you had a moment ago was simply
   * gone, and there was nothing to judge the change against.
   */
  const beforeApplied = useMemo<Settings | null>(() => {
    if (applied.length === 0) return null;
    let out = { ...settings };
    for (let i = applied.length - 1; i >= 0; i--) out = { ...out, ...applied[i].before };
    return out;
  }, [settings, applied]);

  const beforeRes = useMemo(
    () => (beforeApplied ? compute(beforeApplied) : null),
    [beforeApplied],
  );
  const early = useMemo(() => earliestExit(settings), [settings]);
  const ms = useMemo(() => maxSpend(settings), [settings]);
  const enough = useMemo(() => enoughToday(settings), [settings]);
  const needToSave = useMemo(() => extraSavingNeeded(settings), [settings]);

  /*
   * The same two solvers the what-if page uses, so the pages cannot disagree
   * about the same decision. Both are memoised on the settings alone.
   */
  const mix = useMemo(() => bestMix(settings), [settings]);

  /*
   * Sequence risk. Six hundred sequences that all average your growth rate
   * and arrive in a different order, because nobody gets an average.
   *
   * The safe-spend search is the expensive half, so it is fewer targets and
   * its own memo. Both are deterministic given the seed, so nothing moves on
   * screen unless a setting actually changed.
   */


  /*
   * What you actually spend, mortgage included.
   *
   * The field asks for spending without the mortgage, because the payment is
   * calculated and cannot be reconciled with a figure someone typed. But
   * every place the tool *reports* your spending was quoting that same field,
   * so it told you that you spend £30,000 while taking £58,324 out of the
   * pot. The input is split of necessity; the reporting should not be.
   */
  /*
   * The cost in the first year of the plan, not the payment.
   *
   * This read `mortgageSchedule(settings).payment`, which is a nominal
   * constant with no end date attached. The schedule is finite, and the
   * projection only charges the years the schedule actually covers, so on a
   * plan that clears the debt before you stop the two disagree completely: a
   * £420,000 mortgage cleared in a single year at 40 was reported as £438,900
   * a year of retirement spending from 41 to 90, and the ceiling tile offered
   * £490,000 a year to spend. The projection charged none of it.
   */
  const mortgagePay = mortgageCostAt(settings, settings.exit_age);
  const spendAll = settings.annual_spend + mortgagePay;
  /*
   * Said once, and only when the mortgage is still running when you stop.
   *
   * No adjustment here any more: `clearAge` used to hold the last year you
   * paid, so every reader had to add one and only this one did. It is now the
   * age the debt is gone, which is also the age you typed into the field.
   */
  const thenDrops =
    mortgagePay > 0 && res.mortgageClearAge !== null
      ? `, dropping to ${fmtMoney(settings.annual_spend)} at ${res.mortgageClearAge}`
      : '';

  const ok = feasible(res);

  /* ── the answer ──────────────────────────────────────────────────────── */

  let head: string;
  /** Empty when there is nothing to add, and then it is not rendered at all. */
  let sub: string;
  /** The mood of the answer, so the sticker and the words are decided together. */
  let sticker: string;

  if (ok && early && early.delta < 0) {
    sticker = rocketSticker;
    head = `The money would last from ${early.age}, not just ${settings.exit_age}.`;
    sub = `You had planned for ${settings.exit_age}${thenDrops}.`;
  } else if (ok) {
    sticker = celebrateSticker;
    /*
     * The age, not a month.
     *
     * This read "in Aug 2027", a specific month derived from an age given in
     * whole years. Someone who is 40 and eleven months turns 41 next month,
     * not in a year, and the tool has no way of knowing which. Printing a
     * month claims a birthday nobody typed. The duration below it is an
     * approximation and says so.
     */
    head = `The money lasts to ${settings.plan_to}.`;
    /*
     * Nothing, unless the mortgage changes the spending part way through.
     *
     * This said "That is about 12 months from now", which is a fact about the
     * calendar rather than about the plan, and it was the third line in a row
     * saying something small. The line only appears now when it has something
     * the two lines above it do not already carry.
     */
    sub = thenDrops ? `Your spending ${thenDrops.replace(', dropping', 'drops')}.` : '';
  } else if (early) {
    sticker = waitSticker;
    head = `The money runs out. It would last from ${early.age}.`;
    /*
     * Say the size of the gap, not only that there is one.
     *
     * "Waiting until 42 makes it hold" tells you the cure without the
     * diagnosis, so the only way to learn how far off you are was to read it
     * off a tile further down the page. The shortfall is the same figure that
     * tile shows: what you would need on top of everything you have today,
     * with the saving you are already committed to already counted.
     */
    sub =
      enough.shortfall !== undefined && isFinite(enough.shortfall)
        ? `You’re ${fmtShort(enough.shortfall)} short today. Waiting until ${early.age} closes it, or take one of the moves below.`
        : `Waiting until ${early.age} makes it work, or take one of the moves below.`;
  } else {
    sticker = rethinkSticker;
    /*
     * About the numbers, not about the person.
     *
     * This said "Not yet, at any age", which reads as a verdict on a life and
     * is overstated besides: nothing in a projection built on assumptions
     * typed thirty seconds ago is never. Four different sentences said this
     * one thing, all of them final. They say it once now, and they say it
     * about the arithmetic.
     */
    head = 'The money runs out, at any age.';
    const gap =
      enough.shortfall !== undefined && isFinite(enough.shortfall)
        ? `You’re ${fmtShort(enough.shortfall)} short today. `
        : '';
    sub = ms
      ? `${gap}${fmtMoney(spendAll)} a year doesn’t work on these numbers. The most you could spend is about ${fmtMoney(ms + mortgagePay)} a year.`
      : `${gap}${fmtMoney(spendAll)} a year doesn’t work on these numbers. Trim your spending, or add to what you save.`;
  }

  /*
   * What the headline does not already say.
   *
   * The first of these read "Money lasts to 90: Yes" directly under a
   * headline reading "The money lasts to 90." The chip was carrying that
   * detail back when the headline said "Yes, you can stop at 60"; once the
   * headline changed, the two said the same thing an inch apart.
   *
   * They now answer the questions the headline leaves open: how much is
   * spare at the end, and what the years before the pension look like. Both
   * only exist when there is something to report. `sub` was never rendered.
   */
  const checks: { label: string; head: string }[] = [];

  if (res.runsOutAge === null) {
    checks.push({
      label: `Spare at ${settings.plan_to}`,
      head: `${fmtShort(res.endBal)}, ${marginPhrase(res.endBal, spendAll)}`,
    });
  } else {
    checks.push({ label: 'Runs out at', head: String(res.runsOutAge) });
  }

  if (settings.pension_access_age > settings.exit_age) {
    checks.push({
      label: `Before the pension opens at ${settings.pension_access_age}`,
      head:
        res.low.val >= 0
          ? `lowest ${fmtMoney(res.low.val)} at ${res.low.age}`
          : `short ${fmtMoney(Math.abs(res.low.val))} at ${res.low.age}`,
    });
  }

  /*
   * Every tile states the number it is comparing against, and every money
   * figure carries its unit. "£40,741 more than you spend now" left you
   * working out what "now" was, and whether either figure was a year or a
   * month.
   */
  /* What your existing plan puts away between now and stopping. */
  const savedBeforeExit =
    (savingPerYear(settings) + settings.pension_per_year) *
    Math.max(0, settings.exit_age - settings.current_age);

  const facts = [
    /*
     * A pot you would need today, not an amount left to save.
     *
     * It was labelled "Still to save", which read as a target to put away
     * between now and stopping. It is not: the saving you have already
     * committed to is inside the projection this figure comes from, so the
     * gap is what you would need on top of it, as a lump, right now. On a
     * plan saving £120,000 before the exit age, calling a £70,000 gap
     * "still to save" invited exactly the wrong conclusion.
     */
    {
      icon: TargetIcon,
      k: 'Short by, today',
      v: !isFinite(enough.need)
        ? 'Nothing gets there'
        : enough.shortfall !== undefined
          ? fmtShort(enough.shortfall)
          : 'Nothing',
      note: !isFinite(enough.need)
        ? `No pot is enough at ${settings.exit_age} on ${fmtMoney(spendAll)} a year`
        : savedBeforeExit > 0
          ? `You hold ${fmtShort(enough.have)} and need ${fmtShort(
              enough.need,
            )}, with the ${fmtShort(savedBeforeExit)} you save before ${settings.exit_age} already counted`
          : `You hold ${fmtShort(enough.have)}, and need ${fmtShort(enough.need)}`,
      warn: enough.shortfall !== undefined,
    },
    {
      icon: EventIcon,
      k: 'Earliest you can stop',
      v: early ? `Age ${early.age}` : 'None',
      note: early
        ? early.delta === 0
          ? 'The age you picked'
          : `You picked ${settings.exit_age}`
        : 'No age works on these numbers',
      warn: !early || early.delta > 0,
    },
    {
      icon: PaymentsIcon,
      k: 'Most you could spend',
      v: ms ? `${fmtShort(ms + mortgagePay)}/yr` : 'None',
      note: ms
        ? `You spend ${fmtMoney(spendAll)} a year now`
        : 'Nothing works at this age',
      warn: !ms || ms < settings.annual_spend,
    },
    {
      icon: WalletIcon,
      k: `Pot at ${settings.exit_age}`,
      v: fmtShort(res.total0),
      note: `${fmtShort(res.bridge0)} outside the pension, ${fmtShort(res.pension0)} in it`,
      warn: false,
    },
  ];

  /* ── moves ─────────────────────────────────────────────────────────────
     Two different questions, so two different lists.

     Short of the target, every move is sized by solving for the least that
     works. The list used to offer a tenth of your spending and a fifth of it
     as work income, which are guesses: on the plan I tested, it asked for
     £4,500 of cuts where £2,700 was enough, and £9,000 of work where £6,500
     was. Asking someone to give up two thirds more than they need to is worse
     than saying nothing.

     Those minimum fixes all land in the same place by construction, barely
     holding, so there is nothing to rank them by. They are alternatives, and
     presenting them as a ranked list implied an order that was not real.

     Once the plan holds the question changes to what buys you the most, and
     spending money per year is a fair measure of that, so those are ranked.
     Trimming spending is not offered there: it is a sacrifice, not a gain,
     and it scored zero anyway because maxSpend overwrites the spend before
     the projection runs.
     ─────────────────────────────────────────────────────────────────── */

  const moves = useMemo(() => {
    const s = settings;
    type Cand = {
      id: string;
      label: string;
      why: string;
      patch: Partial<Settings>;
      apply: string;
      /** Fixed order for the alternatives, ignored once the plan holds. */
      rank?: number;
    };
    const cands: Cand[] = [];
    const workUntil = Math.min(s.plan_to, s.exit_age + 10);

    if (!ok) {
      const trim = minTrim(s);
      if (trim !== null) {
        cands.push({
          id: 'trim-spend',
          label: `Spend ${fmtMoney(s.annual_spend - trim)} instead of ${fmtMoney(s.annual_spend)}`,
          why: `${fmtMoney(trim)} a year less is the smallest cut that works.`,
          patch: { annual_spend: Math.max(0, s.annual_spend - trim) },
          apply: 'Trim spend',
          rank: 1,
        });
      }

      if (early && early.age > s.exit_age) {
        cands.push({
          id: 'delay-a-year',
          label: `Stop at ${early.age} instead of ${s.exit_age}`,
          why:
            savingPerYear(s) + s.pension_per_year > 0
              ? `${early.age - s.exit_age} more year${early.age - s.exit_age === 1 ? '' : 's'} of work puts ${fmtMoney((savingPerYear(s) + s.pension_per_year) * (early.age - s.exit_age))} more in, and takes the same off the drawdown.`
              : `${early.age - s.exit_age} more year${early.age - s.exit_age === 1 ? '' : 's'} of growth, and the same off the drawdown.`,
          patch: { exit_age: early.age, earn_until_age: Math.max(s.earn_until_age, early.age) },
          apply: 'Work longer',
          rank: 2,
        });
      }

      const earn = minEarnings(s);
      if (earn !== null) {
        cands.push({
          id: 'work-income',
          label: `Earn ${fmtMoney(earn)} a year until ${workUntil}`,
          why: 'The least part-time income that holds the plan together.',
          patch: { earnings_per_year: earn, earn_until_age: workUntil },
          apply: 'Add income',
          rank: 3,
        });
      }

      if (needToSave !== null && needToSave > 0) {
        cands.push({
          id: 'save-more',
          label: `Save ${fmtMoney(needToSave)} a year more before you stop`,
          why: `On top of the ${fmtMoney(savingPerYear(s))} a year you already put aside.`,
          // Into the ISA, which is the better of the two reachable accounts.
          patch: { isa_per_year: s.isa_per_year + needToSave },
          apply: 'Save more',
          rank: 4,
        });
      }
    } else {
      /* The plan holds, so everything here is upside. */

      if (early && early.age < s.exit_age) {
        cands.push({
          id: 'stop-sooner',
          label: `Stop at ${early.age} instead of ${s.exit_age}`,
          why: `${s.exit_age - early.age} year${s.exit_age - early.age === 1 ? '' : 's'} sooner is the earliest that still works.`,
          patch: { exit_age: early.age, earn_until_age: Math.min(s.earn_until_age, early.age) },
          apply: 'Stop sooner',
        });
      }

      if (s.earnings_per_year > 0) {
        cands.push({
          id: 'work-income',
          label: 'Drop the work income entirely',
          why: `Instead of ${fmtMoney(s.earnings_per_year)} a year.`,
          patch: { earnings_per_year: 0 },
          apply: 'Full FIRE',
        });
      } else {
        const amt = Math.max(5000, Math.round((s.annual_spend * 0.2) / 1000) * 1000);
        cands.push({
          id: 'work-income',
          label: `Take on ${fmtMoney(amt)} a year of work`,
          why: 'Your plan currently assumes none.',
          patch: { earnings_per_year: amt, earn_until_age: workUntil },
          apply: 'Add income',
        });
      }

      cands.push({
        id: 'live-longer',
        label: `Plan to ${Math.min(105, s.plan_to + 5)} instead`,
        why: 'In case you live longer than you expected.',
        patch: { plan_to: Math.min(105, s.plan_to + 5) },
        apply: 'Stress test',
      });
    }

    /*
     * Available either way. The mortgage answer and the combination come from
     * the same solvers the what-if page uses, so the two pages cannot give
     * different advice about the same decision.
     */

    if (mix && mix.spendBest > mix.spendNow + 1) {
      cands.push({
        id: 'best-mix',
        label: 'The best mix of mortgage, pension and ISA',
        why: `${mix.says.join(', ')}.`,
        patch: mix.patch,
        apply: 'Use the mix',
        rank: 6,
      });
    }

    const lastsTo = (r: ReturnType<typeof compute>) => r.runsOutAge ?? s.plan_to;
    const baseLasts = lastsTo(res);

    return cands
      .map((c) => {
        const cand = compute({ ...s, ...c.patch });
        const dLow = cand.low.val - res.low.val;
        const dEnd = cand.endBal - res.endBal;
        const dYears = lastsTo(cand) - baseLasts;
        const fixes = !ok && feasible(cand);
        const breaks = ok && !feasible(cand);
        const worth = ok ? spendGain(s, c.patch) : worthToday(s, c.patch);
        const score = (fixes ? 1e9 : 0) - (breaks ? 1e9 : 0) + worth * (ok ? 20 : 1);

        return {
          ...c, dLow, dEnd, dYears, worth, fixes, breaks, score, res: cand,
          runsOutAge: cand.runsOutAge,
          lastsTo: lastsTo(cand),
          runsDry: cand.runsOutAge !== null,
        };
      })
      // A change that moves nothing is not a move.
      .filter((c) => c.fixes || c.breaks || Math.abs(c.worth) >= 1)
      .sort((a, b) => {
        // Short of the target the alternatives keep their written order,
        // because they all end up in the same place and ranking them by the
        // money would have implied one was better than another.
        if (!ok && a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
        return b.score - a.score;
      })
      .slice(0, 5);

  }, [settings, res, ok, needToSave, early, mix]);

  /**
   * Moves you applied that the list no longer suggests, so their undo stays.
   *
   * Taking a move often removes its own reason to exist. Save the shortfall
   * and there is no shortfall left to offer, take on work and the offer flips
   * to dropping it, and either way the row vanished with the only way back on
   * it. These are pinned underneath, showing what you did and an Undo.
   */
  const orphanApplied = useMemo(
    () => applied.filter((a) => !moves.some((m) => m.id === a.id)),
    [applied, moves],
  );

  /**
   * The move you are hovering, drawn under the market you are looking at.
   *
   * It used to be drawn at your own return while the solid line was whatever
   * market tab you had selected. On the good markets tab that put a 5.5%
   * line under a 7% one and the move looked catastrophic: the same plan ends
   * at £4.8m or £574k depending only on which rate drew it. Nothing was wrong
   * with the move. The chart was comparing two different worlds.
   */
  const previewMove = useMemo(
    () => (preview ? moves.find((m) => m.id === preview) ?? null : null),
    [preview, moves],
  );

  const previewRes = useMemo(
    () => (previewMove ? compute({ ...viewSettings, ...previewMove.patch }) : null),
    [previewMove, viewSettings],
  );

  /* ── stress tests ────────────────────────────────────────────────────── */

  const stress = useMemo(
    () =>
      STRESS_TESTS.map((t) => {
        const p = t.patch(settings);
        const r = compute({ ...settings, ...p });
        const good = feasible(r);
        // Years of spending, not a terminal balance. Fifty years of
        // compounding turns any surplus into a number nobody can judge.
        const spare = spareYears(r, settings.annual_spend);
        return {
          ...t,
          patch: p,
          active: marketView === t.id,
          outcome: good
            ? spare >= 40
              ? `Lasts to ${settings.plan_to}, comfortably`
              : `Lasts to ${settings.plan_to}, ${Math.max(0, Math.round(spare))} years spare`
            : r.runsOutAge !== null
              ? `Runs dry at ${r.runsOutAge}`
              : `${fmtShort(Math.abs(r.low.val))} short before the pension`,
          good,
        };
      }).concat(
        /*
         * The historical tab, appended rather than written into the list,
         * because it is a different kind of thing: the other three are a rate
         * you could type yourself, this one is a record.
         */
        history && worstRun
          ? [
              {
                id: 'history',
                name: 'What happened',
                note: `worst of ${history.tested} real starts`,
                patch: {},
                active: marketView === 'history',
                outcome:
                  historyRes && feasible(historyRes)
                    ? `${history.survived} of ${history.tested} starts lasted`
                    : `Starting in ${worstRun.startYear}: dry at ${historyRes?.runsOutAge ?? '?'}`,
                good: historyRes ? feasible(historyRes) : false,
                isActive: () => false,
              },
            ]
          : [],
      ),
    [settings, marketView],
  );

  /* ── scenarios ───────────────────────────────────────────────────────── */

  function saveScenario() {
    const name = scenarioName.trim() || `Plan ${scenarios.length + 1}`;
    const id = makeId();
    setScenarios((prev) => [
      ...prev,
      { id, name, settings, saved: new Date().toISOString().slice(0, 10) },
    ]);
    setActivePlanId(id);
    setScenarioName('');
    setSaveOpen(false);
  }


  /** Wipe everything and go back to the questions. */
  function startOver() {
    if (!confirm('Delete your plan and saved scenarios from this browser? This can’t be undone.')) return;
    setScenarios([]);
    setBaseline(null);
    setSettings(DEFAULTS);
    setApplied([]);
    setSetupDone(false);
  }

  /* ── setup gate ──────────────────────────────────────────────────────── */

  /*
   * Setup runs once. Everything it asks for is a lever in the rail now, so
   * there is nothing to come back and edit: you change it where you read it.
   * Start over, in the rail, is the way back here.
   */
  if (!setupDone) {
    return (
      <Setup
        existing={setupDone ? settings : null}
        onCancel={null}
        onDone={(next) => {
          setSettings(next);
          setSetupDone(true);
          setApplied([]);
        }}
        onStartOver={startOver}
      />
    );
  }

  /* ── main ────────────────────────────────────────────────────────────── */

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <SiteHeader />

      <Container maxWidth={false} sx={{ py: 2, px: { xs: 2, sm: 3, lg: 5 } }}>
        {/*
          * One page.
          *
          * There were two tabs, "Your plan" and "How it works", which gave a
          * reference document equal billing with the thing it is a reference
          * for and put a row of navigation above a product that has one
          * screen. Nobody opens this wanting to read the assumptions; they
          * open it with a number they do not believe. So the notes moved to
          * the foot of the plan, a section at a time, where you reach them
          * after the answer instead of instead of it.
          */}
        <Grid container spacing={2}>
          {/* 8.5 and 3.5 rather than 9 and 3. The rail carries four groups,
              a tax section and your details now, and at a quarter of the width
              every label was fighting its field. The canvas gives up about
              4% and loses nothing: the chart was the widest thing on it and
              is still wider than it needs to be. */}
          <Grid size={{ xs: 12, lg: 8.5 }} sx={{ order: { xs: 1, lg: 2 } }}>
            {/* the answer */}
            <Card
              sx={{
                mb: 2,
                background: bannerGradient(ok),
                color: 'common.white',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* The theme sets `&:last-child { paddingBottom }` on every
                  CardContent, and that beats a plain pb from sx on
                  specificity, so the bottom has to be set the same way or it
                  silently ignores you. */}
              <CardContent
                sx={{
                  position: 'relative',
                  px: { xs: 2.5, sm: 3.5 },
                  pt: { xs: 2, sm: 2.25 },
                  pb: { xs: 1.5, sm: 1.75 },
                  '&:last-child': { pb: { xs: 1.5, sm: 1.75 } },
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 2, sm: 4 }}
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    {/*
                      * The conditions, not a question.
                      *
                      * This asked "Can you stop working?", which is a question
                      * nobody typed, put in the reader's mouth by the tool and
                      * then answered by it. Neutral products state what they
                      * tested and what came back. So: the test above, the
                      * result below.
                      */}
                    {/* One supporting weight, not two. The overline was at
                        0.75 and the line under the headline at 0.8, which is
                        a difference nobody can see and everybody's eye has to
                        resolve. */}
                    {/*
                      * One loud voice, and the rest quiet.
                      *
                      * There were four type styles stacked here, three of them
                      * making a statement: an uppercase overline on wide
                      * tracking, a 44px headline on tight tracking, and a 16px
                      * subtitle. Uppercase and letterspacing are emphasis, and
                      * spending them on an 11px label meant the smallest line
                      * in the card was shouting as hard as the biggest.
                      *
                      * The condition is a label. It is set like one now: plain
                      * case, no tracking, quiet. The answer is the only thing
                      * in this card allowed to be loud.
                      */}
                    {/* Tinted, not faded. See bannerTint. */}
                    <Typography
                      sx={{
                        fontSize: '0.8125rem',
                        fontWeight: 400,
                        lineHeight: 1.4,
                        letterSpacing: 0,
                        color: bannerTint(ok),
                      }}
                    >
                      {`Retiring at ${settings.exit_age} on ${fmtMoney(spendAll)} a year`}
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.25,
                        fontSize: { xs: '1.875rem', sm: '2.5rem' },
                        fontWeight: 400,
                        lineHeight: 1.15,
                        letterSpacing: '-0.021em',
                      }}
                    >
                      {head}
                    </Typography>

                    {/* body2, not subtitle1. At 16px regular it sat almost
                        level with the headline's weight on the page and read
                        as a second statement rather than a footnote to the
                        first. It matches the label above it now, so the card
                        has one size for the answer and one for everything
                        that qualifies it. */}
                    {/* Skipped entirely when empty, rather than rendered as a
                        blank line holding margin open under the headline. */}
                    {sub && (
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.75, color: bannerTint(ok), maxWidth: 560 }}
                      >
                        {sub}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.25 }}>
                      {checks.map((c) => (
                        <Chip
                          key={c.label}
                          label={`${c.label}: ${c.head}`}
                          sx={{ bgcolor: bannerChipFill, color: 'common.white', height: 28 }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  {/* Decorative: the headline already says this, so it carries
                      no alt text and is hidden from screen readers. */}
                  <Box
                    aria-hidden
                    sx={{
                      flex: 'none',
                      display: { xs: 'none', sm: 'grid' },
                      placeItems: 'center',
                      width: { sm: 108, md: 124 },
                      height: { sm: 108, md: 124 },
                      // A rounded square rather than a circle, matching the
                      // card language everywhere else on the page.
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.10)',
                    }}
                  >
                    <Box
                      component="img"
                      src={sticker}
                      alt=""
                      sx={{
                        width: { sm: 68, md: 78 },
                        height: 'auto',
                        display: 'block',
                        userSelect: 'none',
                      }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <PlansBar
              scenarios={scenarios}
              activeId={activePlanId}
              dirty={planDirty}
              expanded={plansOpen}
              onToggle={() => setPlansOpen((v) => !v)}
              onSave={() => {
                setScenarioName(`Plan ${scenarios.length + 1}`);
                setSaveOpen(true);
              }}
              onLoad={(id) => {
                const sc = scenarios.find((x) => x.id === id);
                if (!sc) return;
                setSettings(sc.settings);
                setActivePlanId(id);
                setApplied([]);
                setPlansOpen(false);
              }}
              onDelete={(id) => {
                setScenarios((prev) => prev.filter((x) => x.id !== id));
                if (activePlanId === id) setActivePlanId(null);
              }}
              onRename={(id, name) =>
                setScenarios((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)))
              }
            />

            {/* the four figures */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {facts.map((f) => (
                <Grid size={{ xs: 6, md: 3 }} key={f.k}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <f.icon sx={{ fontSize: 16, color: 'text.tertiary' }} />
                        <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                          {f.k}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="h2"
                        sx={{ mt: 0.75, mb: 1, color: f.warn ? 'error.main' : 'text.primary' }}
                      >
                        {f.v}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                        {f.note}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* chart */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                {/* Pinning compares this line against a saved one, so it is a
                    chart-level action and belongs on the chart's title row,
                    not trailing off the end of the market switcher. */}
                <Stack
                  direction="row"
                  spacing={2}
                  useFlexGap
                  sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 2 }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <SectionIcon icon={ChartIcon} />
                    <Typography variant="h3">Money you can spend, year by year</Typography>
                  </Stack>

                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={marketView}
                        onChange={(_, v) => v && setMarketView(v)}
                        aria-label="Market assumption"
                      >
                        {stress.map((t) => (
                          <ToggleButton key={t.id} value={t.id}>
                            <Stack sx={{ alignItems: 'flex-start' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                                {t.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: t.good ? 'text.secondary' : 'error.main', lineHeight: 1.3 }}
                              >
                                {t.outcome}
                              </Typography>
                            </Stack>
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<PushPinIcon />}
                      onClick={() => setBaseline(settings)}
                    >
                      {baseline ? 'Re-pin to now' : 'Pin this plan'}
                    </Button>
                      {baseline && <Button size="small" onClick={() => setBaseline(null)}>Unpin</Button>}
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>

              {/* What history says you could have spent. The count alone
                  says there is a problem without saying what fixes it. */}
              {marketView === 'history' && history && (
                <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>
                      {history.survived} of {history.tested}
                    </strong>{' '}
                    real starting years lasted to {settings.plan_to} on {fmtMoney(settings.annual_spend)} a
                    year.
                    {historySafe !== null && historySafe > 0 && (
                      <>
                        {' '}
                        Spending <strong>{fmtMoney(historySafe)}</strong> would have survived every
                        one of them, including {worstRun?.startYear}.
                      </>
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.tertiary', display: 'block', mt: 0.5 }}>
                    {HISTORY_SOURCE}. American history, which was the luckiest of the big markets, so
                    read this as a good case rather than a neutral one.
                  </Typography>
                </Box>
              )}

              {/* The chart's own settings, directly above the line they draw.
                  They were at the foot of the card, below the moves, which put
                  the chart's description further from it than anything else. */}
              <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Assumptions settings={settings} res={res} onEdit={() => setAssumeOpen(true)} />
              </Box>

              <CardContent>
                <BalanceChart
                  res={viewRes}
                  baseRes={baseRes}
                  settings={viewSettings}
                  lineLabel={
                    marketView === 'history' && worstRun
                      ? `Your plan, if you had started in ${worstRun.startYear}`
                      : marketView === 'base'
                        ? `This plan, ${settings.growth_after}% less ${settings.inflation}% inflation`
                        : `${stress.find((t) => t.id === marketView)?.name}, ${viewSettings.growth_after}% less ${viewSettings.inflation}%`
                  }
                  previewRes={previewRes}
                  previewLabel={previewMove?.label}
                  // Only against the plan itself. Under a stress test the
                  // solid line is already a different market, and a second
                  // market underneath it would compare nothing.
                  beforeRes={marketView === 'base' ? beforeRes : null}
                  beforeLabel={
                    applied.length === 1
                      ? 'Before this change'
                      : `Before your ${applied.length} changes`
                  }
                />
              </CardContent>

              <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
                  <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
                    The best moves you could make · hover to preview
                  {marketView !== 'base' && ` · worth measured on your own ${settings.growth_after}%`}
                  </Typography>
                </Box>
              {/* Flat rows, nothing hidden.
                  These were accordions, which meant clicking a chevron to
                  reveal one short sentence and a button. There is nothing
                  here worth hiding, so it is all on screen. */}
              {moves.map((m) => {
                const done = applied.find((a) => a.id === m.id);
                const isApplied = !!done;
                return (
                  <Box
                    key={m.id}
                    onPointerEnter={() => setPreview(m.id)}
                    onPointerLeave={() => setPreview((v) => (v === m.id ? null : v))}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
                      columnGap: 2,
                      rowGap: 0.5,
                      alignItems: 'center',
                      px: { xs: 2, sm: 3 },
                      py: 1,
                      bgcolor: isApplied
                        ? 'primary.light'
                        : preview === m.label ? 'surfaceContainer' : 'transparent',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {done ? done.label : m.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                        {m.why}
                      </Typography>
                    </Box>

                    <Box>
                      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {isApplied && <Chip color="primary" label="Applied" />}
                        {m.fixes && <Chip color="success" label="Makes it work" />}
                        {/* Where it fails, not that it fails. "Breaks it"
                            named a verdict and left you hunting the chart for
                            the year. */}
                        {m.breaks && (
                          <Chip
                            color="error"
                            label={
                              m.runsOutAge !== null
                                ? `Runs out at ${m.runsOutAge}`
                                : `Short ${fmtMoney(Math.abs(m.res.low.val))} at ${m.res.low.age}`
                            }
                          />
                        )}
                        {!m.fixes && !m.breaks && (
                          <Chip
                            color={m.worth >= 0 ? 'primary' : 'error'}
                            /*
                             * "a year to spend" read as a one-off: this much,
                             * in a year. It is the sustainable ceiling going
                             * up, so it lands every year for the whole plan.
                             * "every year" is the word that says so.
                             */
                            label={
                              ok
                                ? m.worth >= 0
                                  ? `+${fmtMoney(m.worth)} to spend, every year`
                                  : `${fmtMoney(-m.worth)} less to spend, every year`
                                : m.worth >= 0
                                  ? `Closes ${fmtMoney(m.worth)} of the gap`
                                  : `Widens the gap by ${fmtMoney(-m.worth)}`
                            }
                          />
                        )}
                      </Stack>
                    </Box>

                    <Box sx={{ justifySelf: 'start' }}>
                      {isApplied ? (
                        <Button size="small" startIcon={<UndoIcon />} onClick={() => undoMove(m.id)}>
                          Undo
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => applyMove(m.id, m.label, m.patch)}
                        >
                          {m.apply}
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })}

              {/* Applied moves the list has stopped suggesting. Without these
                  the only way back disappeared with the row. */}
              {orphanApplied.map((o) => (
                <Box
                  key={o.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
                    columnGap: 2,
                    rowGap: 0.5,
                    alignItems: 'center',
                    px: { xs: 2, sm: 3 },
                    py: 1,
                    bgcolor: 'primary.light',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {o.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                      {o.note ?? 'Already in your plan, so it’s no longer suggested.'}
                    </Typography>
                  </Box>

                  <Box>
                    <Chip color="primary" label="Applied" />
                  </Box>

                  <Box sx={{ justifySelf: 'start' }}>
                    <Button size="small" startIcon={<UndoIcon />} onClick={() => undoMove(o.id)}>
                      Undo
                    </Button>
                  </Box>
                </Box>
              ))}
              </Box>
            </Card>

            <Card sx={{ mb: 2 }}>
              <YearTable
                res={res}
                settings={settings}
                planName={activePlan?.name ?? 'Unsaved plan'}
              />
            </Card>

            <AssumptionsPage settings={settings} />

            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.tertiary' }}>
              Not financial advice. Today’s money. Stays in your browser.
            </Typography>
          </Grid>

          {/* the rail. Left on wide screens, but below the answer on small
              ones, so a phone does not open on a wall of sliders. */}
          <Grid
            size={{ xs: 12, lg: 3.5 }}
            sx={{
              order: { xs: 2, lg: 1 },
              // Stays put while the results scroll past it, so the controls
              // are still there when you reach the chart. Only on wide
              // screens; stacked below the answer there is nothing to stick to.
              position: { lg: 'sticky' },
              top: { lg: 80 },
              alignSelf: { lg: 'flex-start' },
              maxHeight: { lg: 'calc(100dvh - 96px)' },
              overflowY: { lg: 'auto' },
              // Scrolls, but the bar is not drawn. A permanent grey track down
              // the inside edge of a column this narrow reads as a border and
              // competes with the card edges beside it.
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              // No reserved scrollbar gutter. It held ~15px of permanent empty
              // space against the content column for a scrollbar that only
              // appears when several lever groups are open at once.
            }}
          >
            <Levers
              settings={settings}
              res={res}
              onChange={patch}
              open={open}
              onToggleGroup={(id) => setOpen((o) => ({ ...o, [id]: !o[id] }))}
              onStartOver={startOver}
            />
            {/* Three facts in, two answers out. Its own card because a
                mortgage is a small self-contained sum, not a row of levers. */}
            <MortgageCard
              settings={settings}
              onChange={patch}
              open={!!open.mortgage}
              onToggle={() => setOpen((o) => ({ ...o, mortgage: !o.mortgage }))}
            />

            {/* The two growth rates and inflation. Together because they are
                one sum, and out of the time groups because both labels used to
                repeat the heading they sat under. */}
            <GrowthCard
              settings={settings}
              onChange={patch}
              open={!!open.growth}
              onToggle={() => setOpen((o) => ({ ...o, growth: !o.growth }))}
            />

            {/* Its own section, below the plan. The rail above is what you
                chose; this is the rules those choices are being scored
                against, and anyone who wants to model it differently can. */}
            <TaxCard
              settings={settings}
              onChange={patch}
              open={!!open.tax}
              onToggle={() => setOpen((o) => ({ ...o, tax: !o.tax }))}
            />
          </Grid>
        </Grid>
      </Container>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save this plan</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" sx={{ mt: 1 }}
            label="Name"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveScenario(); }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveScenario}>Save</Button>
        </DialogActions>
      </Dialog>

      {assumeOpen && (
        <EditModal
          settings={settings}
          onChange={patch}
          onClose={() => setAssumeOpen(false)}
        />
      )}
    </Box>
  );
}


/* ── header ────────────────────────────────────────────────────────────────
   Aligned to the same container as the content, so the brand and the actions
   sit on the page grid rather than out at the window edges. Flat at rest and
   lifting only once you scroll under it, which is the one place a shadow
   genuinely means "this is floating above something".
   ──────────────────────────────────────────────────────────────────────── */

function SiteHeader() {
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={scrolled ? 2 : 0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: scrolled ? 'transparent' : 'divider',
        transition: 'box-shadow 160ms, border-color 160ms',
      }}
    >
      <Container maxWidth={false} disableGutters sx={{ px: { xs: 2, sm: 3, lg: 5 } }}>
        <Toolbar disableGutters sx={{ gap: 1.5, minHeight: { xs: 60, sm: 64 } }}>
          <RunwayMark />

          <Typography variant="h4" sx={{ fontWeight: 500, letterSpacing: '-0.01em' }} noWrap>
            {APP_NAME}
          </Typography>

          {/* A rule between the name and what it does, so they read as two
              things rather than one long phrase. A dot would sit on the
              baseline and get read as punctuation inside the sentence; a
              vertical rule spans the line and separates. */}
          <Box
            aria-hidden
            sx={{
              display: { xs: 'none', sm: 'block' },
              flex: 'none',
              width: '1px',
              alignSelf: 'stretch',
              my: 2,
              bgcolor: 'divider',
            }}
          />

          {/* What it is. The product never said, anywhere, and a name on its
              own tells a first-time reader nothing. Hidden on a phone, where
              the bar has no room and the setup screen says it instead. */}
          <Typography
            variant="body2"
            sx={{ color: 'text.tertiary', display: { xs: 'none', sm: 'block' } }}
            noWrap
          >
            {APP_TAGLINE}
          </Typography>


        </Toolbar>
      </Container>
    </AppBar>
  );
}
