import { useId, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, InputBase,
  Slider, Stack, Switch, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartIcon from '@mui/icons-material/RestartAltOutlined';
import SavingsIcon from '@mui/icons-material/SavingsOutlined';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import OutIcon from '@mui/icons-material/ArrowOutwardOutlined';
import TaxIcon from '@mui/icons-material/ReceiptLongOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import type { Projection, Settings } from '../engine/types';
import { GROUPS, TIMELINE, resolveBound, resolveHint, resolveLabel, type Lever } from '../engine/config';
import { reachableNow } from '../engine/compute';
import { currency, fmtMoney, parseMoney } from '../engine/format';

/**
 * The levers rail.
 *
 * Every number is typed. There are no tracks.
 *
 * Sliders were here for the values you might want to sweep while watching the
 * chart answer, but they earned less than they cost: a second control for the
 * same number, a second way to be a pixel out, and a rail that read as
 * machinery rather than as your figures. Everything is a field now, so there
 * is one way to set anything and the numbers are the loudest thing on it.
 *
 * No accent colour in here either. Purple marks things you press elsewhere on
 * the page, and a rail of twenty purple anything turns it into wallpaper.
 */

interface Props {
  settings: Settings;
  /** Only for the running totals under two of the groups. */
  res: Projection;
  onChange: (patch: Partial<Settings>) => void;
  open: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  /**
   * Wipe everything and go back to the questions.
   *
   * There was a Reset beside this that put every lever back to whatever you
   * typed at setup. It restored a snapshot written once and never updated, so
   * after a week it meant "back to day one", which is not a place anyone
   * wants to go. Saving a plan and loading it back does the same job with a
   * name and a date on it, and lets you pick the point you return to.
   */
  onStartOver: () => void;
}

const GROUP_ICON: Record<string, SvgIconComponent> = {
  today: WalletIcon,
  before: SavingsIcon,
  after: OutIcon,
  tax: TaxIcon,
};

export function Levers({ settings, res, onChange, open, onToggleGroup, onStartOver }: Props) {
  return (
    <Card>
      <Stack
        direction="row"
        sx={{ px: 2, pt: 1, pb: 0.5, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
          Your plan
        </Typography>
        <Button
          size="small"
          startIcon={<RestartIcon />}
          onClick={onStartOver}
          sx={{ mr: -1, color: 'text.tertiary' }}
        >
          Start over
        </Button>
      </Stack>

      {/* The three dates, across the top and never folded away.
          Nothing below them means anything until they are set, and two of
          them used to be hidden behind a chevron. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          columnGap: 1.5,
          px: 2,
          pt: 1.5,
          pb: 2,
          // The rule under the card header used to come from the first
          // accordion's top border. The timeline sits between them now, so it
          // carries the rule instead.
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {TIMELINE.map((l) => (
          <LeverControl key={l.k} lever={l} settings={settings} onChange={onChange} stacked />
        ))}
      </Box>

      {GROUPS.filter((g) => !g.hiddenFromRail).map((g) => {
        const Icon = GROUP_ICON[g.id];
        return (
          <Accordion
            key={g.id}
            expanded={!!open[g.id]}
            onChange={() => onToggleGroup(g.id)}
            sx={{ bgcolor: 'transparent', borderTop: 1, borderColor: 'divider' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: 'text.tertiary' }} />}
            >
              {/* The icon is bare and close to its label. Boxed in a white
                  tile it read as a raised object inside an already raised
                  card, and four of them down the rail was clutter. */}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                {Icon && (
                  <Icon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>
                    {g.title}
                  </Typography>
                  {g.note && (
                    <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                      {g.note}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              {/* 8px, not the 4 it had. Four was right when a group held four
                  short rows; the rail has grown since and the same gap now
                  reads as one dense block instead of separate settings. */}
              <Stack spacing={1}>
                {/* Config order. The old sort pulled the swept controls to
                    the top of every group, which split pairs that have to be
                    read together, like an allowance and the rate past it.
                    With nothing to sweep there is nothing to sort. */}
                {g.items.map((item) => (
                  <LeverControl
                    key={item.k}
                    lever={item}
                    settings={settings}
                    onChange={onChange}
                    hintOnHover
                  />
                ))}
              </Stack>

              {/* What all of this adds up to by the time you stop.
                  The group is four numbers that each nudge the same pot, and
                  the pot was only visible on a tile across the page. Putting
                  it under the fields is what lets you turn one and watch. */}
              {g.id === 'before' && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    mt: 1.5, pt: 1.5, alignItems: 'baseline',
                    justifyContent: 'space-between',
                    borderTop: 1, borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Total at {settings.exit_age}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtMoney(res.total0)}
                  </Typography>
                </Stack>
              )}

              {/* No combined spending total here. There was one, and it
                  argued with the label an inch above it: the field says "not
                  counting the mortgage" and then a bold line counted it. The
                  mortgage has its own card with its own payment, which is
                  where anyone wanting that figure already is. */}
              {/* Four balances and no total was four numbers to add up in your
                  head to answer the first question anyone asks of them. The
                  split matters for tax and access; the sum is what you have. */}
              {g.id === 'today' && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    mt: 1.5, pt: 1.5, alignItems: 'baseline',
                    justifyContent: 'space-between',
                    borderTop: 1, borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Total
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtMoney(reachableNow(settings) + settings.pension_now)}
                  </Typography>
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Card>
  );
}

/* ── one lever ─────────────────────────────────────────────────────────── */

export function LeverControl({
  lever,
  settings,
  onChange,
  slider = false,
  hintOnHover = false,
  stacked = false,
}: {
  lever: Lever;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  /**
   * Draw a track under the field.
   *
   * Off everywhere by default, and deliberately: in the rail a slider was a
   * second control for a number you already knew, and twenty of them made the
   * machinery louder than the figures. On the what-if page the job is the
   * opposite. You do not know the answer, you are sweeping for it and
   * watching the chart move, which is the one thing a track is better at than
   * a field. Both are here, so you can drag to find it and type to land on it.
   */
  slider?: boolean;
  /**
   * Put the hint on hover instead of under the label.
   *
   * On in the rail, off on the what-if page, and the difference is what the
   * hint is for. In the rail it is help: fixed wording explaining what a
   * setting means, which you read once and then never again while it goes on
   * taking a line per row for the rest of the session. Twenty of those is why
   * the column reads as busy.
   *
   * On the what-if page the same slot carries live arithmetic that answers
   * the question you are asking as you drag, like what is left on the other
   * side of a split. That is not help and it cannot hide.
   */
  hintOnHover?: boolean;
  /**
   * Label above the field instead of beside it.
   *
   * The row layout puts a label on the left and a field on the right, which
   * needs the full width of the rail. Two of these have to sit side by side
   * at the top, so they stack instead.
   */
  stacked?: boolean;
}) {
  const id = useId();
  const value = settings[lever.k] as number;
  const dimmed = lever.dep ? !settings[lever.dep] : false;
  const hint = resolveHint(lever.hint, settings);
  const problem = lever.problem ? lever.problem(settings) : null;
  // A hint that changes the meaning of the number is never hidden.
  const hideHint = hintOnHover && !lever.alwaysHint;
  const label = resolveLabel(lever.label, settings);
  const set = (n: number) => onChange({ [lever.k]: n } as Partial<Settings>);

  /* A switch is the one thing here that is not a number. */
  if (lever.kind === 'toggle') {
    return (
      <Box sx={{ opacity: dimmed ? 0.38 : 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <WithHint hint={hint} onHover={hideHint}>
            <Typography
              variant="body2"
              color="text.secondary"
              component="label"
              htmlFor={id}
              sx={hint && hideHint ? { cursor: 'help' } : undefined}
            >
              {label}
            </Typography>
          </WithHint>
          <Switch id={id} size="small" checked={!!value} onChange={(e) => set(e.target.checked ? 1 : 0)} />
        </Stack>
        {hint && !hideHint && <Hint>{hint}</Hint>}
        {problem && <Problem>{problem}</Problem>}
      </Box>
    );
  }

  const min = resolveBound(lever.min, settings, 0);
  const max = resolveBound(lever.max, settings, 100);
  const step = lever.step ?? 1;

  const prefix = lever.kind === 'money' ? currency().symbol : '';
  const suffix = lever.kind === 'pct' ? '%' : '';

  /*
   * Floors are real, ceilings mostly were not.
   *
   * A max used to be the visible end of a track, so it explained itself. As a
   * plain field it is an invisible rule that rewrites what you typed: the
   * spend ceiling is twice your current spend, so typing 200,000 over a
   * 50,000 plan silently gave you 100,000 and no reason why.
   *
   * So only the honest ceilings are kept. Ages have to stay in order against
   * each other, and a percentage cannot pass 100. Everything else is your
   * number, however large.
   */
  const cap = lever.kind === 'age' ? max : lever.kind === 'pct' ? 100 : Infinity;
  const clamp = (n: number) => Math.min(Math.max(n, min), cap);

  return (
    <Box sx={{ opacity: dimmed ? 0.38 : 1 }}>
      {/* The hint belongs in the left column under its label, not below the
          whole row. Sitting outside, it fell away from the label while the
          label floated vertically centred against a taller value box. */}
      {/* Stretch, not baseline.
          The field used to be sized by its own padding, so a row with a hint
          under the label had a short box floating against two lines of text.
          Now the row is as tall as its text and the field fills it, which
          means the box always matches label plus hint exactly, without anyone
          having to keep a pixel height in sync with the type scale. */}
      <Stack
        direction={stacked ? 'column' : 'row'}
        spacing={stacked ? 0.25 : 1}
        sx={
          stacked
            ? { alignItems: 'stretch' }
            : { alignItems: 'stretch', justifyContent: 'space-between' }
        }
      >
        <Box
          sx={{
            minWidth: 0, flex: 1,
            // Centred for the rows that have no hint, so a single line sits
            // in the middle of the field's minimum height rather than on top.
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
        >
          <WithHint hint={hint} onHover={hideHint}>
            <Typography
              variant="body2"
              color="text.secondary"
              component="label"
              htmlFor={id}
              id={`${id}-label`}
              // Tighter than body2's 1.43. The label and its hint are one
              // thought, and the default leading opened a gap between them
              // wider than the gap to the next row.
              sx={{ lineHeight: 1.3, ...(hint && hideHint ? { cursor: 'help' } : null) }}
            >
              {label}
            </Typography>
          </WithHint>
          {hint && !hideHint && <Hint>{hint}</Hint>}
        </Box>

        <EditableNumber
          id={id}
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={step < 1 ? 2 : 0}
          disabled={dimmed}
          wrong={!!problem}
          fullWidth={stacked}
          onCommit={(n) => set(clamp(n))}
        />
      </Stack>

      {problem && <Problem>{problem}</Problem>}
      {slider && (
        <Slider
          aria-labelledby={`${id}-label`}
          size="small"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          disabled={dimmed}
          onChange={(_, v) => set(v as number)}
          // 4px clear of the row above. A track butted up against text reads
          // as part of that line rather than as its own control.
          sx={{ mt: 0.5, display: 'block' }}
        />
      )}
    </Box>
  );
}

/**
 * The label, with its explanation on hover when the row is in help mode.
 *
 * `describeChild` so a screen reader reads the label and then the hint,
 * rather than the hint replacing the label, which is what a plain tooltip
 * does and would have made every field in the rail anonymous.
 *
 * A help cursor is the whole affordance. Anything else, an icon or an
 * underline, would put back the pixel the hint just gave up.
 */
function WithHint({
  hint,
  onHover,
  children,
}: {
  hint: string;
  onHover: boolean;
  children: React.ReactElement;
}) {
  if (!hint || !onHover) return children;
  return (
    <Tooltip title={hint} placement="top-start" describeChild enterDelay={200}>
      {children}
    </Tooltip>
  );
}

/**
 * Something is wrong with this value.
 *
 * Red, and always visible. The hints went behind a hover because they are
 * help you read once; this is not help, it is the tool telling you the answer
 * above is built on something that cannot be true.
 */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      role="alert"
      sx={{ color: 'var(--warn)', display: 'block', mt: 0.25, lineHeight: 1.35 }}
    >
      {children}
    </Typography>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: 'text.tertiary', display: 'block', lineHeight: 1.3 }}
    >
      {children}
    </Typography>
  );
}

/* ── the value ─────────────────────────────────────────────────────────────
   Reads as text until you click it, then behaves as a field. Every number in
   the rail is typeable, so you are never forced to hunt for an exact figure
   with a drag.

   The draft is held only while focused and dropped on blur. Keeping it beyond
   that was the old bug where a field stopped reflecting applied moves,
   presets and Import once you had typed in it.
   ──────────────────────────────────────────────────────────────────────── */

function EditableNumber({
  id, value, prefix, suffix, decimals, disabled, wrong, fullWidth, onCommit,
}: {
  id: string;
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  disabled?: boolean;
  /** Outlined in the warning colour while the value contradicts something. */
  wrong?: boolean;
  /** Fills its column rather than sitting at a fixed 96px. */
  fullWidth?: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  /*
   * A setting that is somehow missing shows as zero rather than crashing.
   *
   * The cause is always fixed upstream, but a single absent number should
   * degrade to one wrong field, not a blank page. This one took the whole app
   * down whenever an old saved plan was loaded.
   */
  const safe = Number.isFinite(value) ? value : 0;

  const pretty = safe.toLocaleString(currency().locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return (
    <Stack
      direction="row"
      sx={{
        flex: 'none',
        // Narrower. Every figure in the rail fits inside 96px at this size,
        // and the extra 20 was pushing the labels into wrapping on a column
        // that is already the tightest thing on the page.
        width: fullWidth ? '100%' : 96,
        // Centred within whatever height the row turned out to be. The floor
        // was one label plus one hint; with the hint on hover a row is one
        // line, so 30 is the comfortable height for it rather than the 34 a
        // two-line row needed.
        alignItems: 'center',
        // Right aligned in a row, where the number is the answer to a label
        // on the far left and a column of figures should line up. Left
        // aligned when stacked, where it reads straight down from its own
        // label and there is no column to line up with.
        justifyContent: fullWidth ? 'flex-start' : 'flex-end',
        minHeight: 30,
        px: 1,
        borderRadius: '4px',
        border: 1,
        borderColor: wrong ? 'var(--warn)' : 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 120ms',
        '&:hover': { borderColor: wrong ? 'var(--warn)' : disabled ? 'divider' : 'text.tertiary' },
        '&:focus-within': { borderColor: wrong ? 'var(--warn)' : 'text.secondary' },
      }}
    >
      {prefix && (
        <Typography variant="body2" sx={{ color: 'text.tertiary', mr: 0.25 }}>
          {prefix}
        </Typography>
      )}
      <InputBase
        id={id}
        disabled={disabled}
        value={draft ?? pretty}
        inputMode="decimal"
        autoComplete="off"
        onFocus={(e) => { setDraft(String(safe)); queueMicrotask(() => e.target.select()); }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseMoney(e.target.value);
          if (n !== null) onCommit(n);
        }}
        onBlur={() => {
          const n = parseMoney(draft ?? '');
          if (n !== null) onCommit(n);
          setDraft(null);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        sx={{
          flex: 1,
          '& input': {
            p: 0,
            textAlign: fullWidth ? 'left' : 'right',
            width: '100%',
            fontSize: '0.875rem',
            // 500, not 600. Twenty numbers at semibold in one narrow column
            // read as a wall rather than as twenty separate figures, and the
            // weight was doing work the tabular figures already do.
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: 'text.primary',
          },
        }}
      />
      {suffix && (
        <Typography variant="body2" sx={{ color: 'text.tertiary', ml: 0.25 }}>
          {suffix}
        </Typography>
      )}
    </Stack>
  );
}
