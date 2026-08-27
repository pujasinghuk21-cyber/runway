import { Box, Button, Stack, Typography } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import type { Projection, Settings } from '../engine/types';
import { monthsToExit, savingPerYear, mortgageSchedule, mortgageCostAt } from '../engine/compute';
import { fmtMoney } from '../engine/format';

/**
 * A plain restatement of the plan the chart is drawing.
 *
 * The line is the output of about fifteen controls in the rail, and one Edit
 * button opens all of them without crossing the page. Anything sitting at a
 * default and doing nothing is omitted, so the list only ever shows what is
 * actually shaping the projection.
 */
export function Assumptions({
  settings: s,
  res,
  onEdit,
}: {
  settings: Settings;
  res: Projection;
  onEdit: () => void;
}) {
  const facts: { k: string; v: string; t?: string }[] = [];

  facts.push({
    k: 'Stop at',
    v: monthsToExit(s) <= 0 ? `${s.exit_age}, now` : String(s.exit_age),
  });
  // Mortgage included, because that is what leaves the account, but only for
  // the years it is actually being paid. This added the payment to every year
  // of the plan whether or not the mortgage was still running, which on a debt
  // cleared before you stop is the entire figure and none of it real.
  facts.push({
    k: 'Spend, after tax',
    v: `${fmtMoney(s.annual_spend + mortgageCostAt(s, s.exit_age))}/yr`,
  });
  // Both, because one without the other says nothing. Two short numbers fit
  // where one number and a hidden qualifier did not.
  facts.push({ k: 'Growth', v: `${s.growth_after}%`, t: 'before inflation' });
  facts.push({ k: 'Inflation', v: `${s.inflation}%` });
  facts.push({
    k: 'Work income',
    v: s.earnings_per_year > 0 ? `${fmtMoney(s.earnings_per_year)} to ${s.earn_until_age}` : 'None',
  });
  const saved = savingPerYear(s);
  facts.push({ k: 'Saving', v: saved > 0 ? `${fmtMoney(saved)}/yr` : 'None' });
  // "Pension unlocks at" and "State pension" are not listed here: the chart
  // immediately above draws both as labelled markers on the age axis.
  // The payment is calculated now, so the strip reads it off the schedule
  // rather than echoing a number that was typed.
  if (s.mortgage_balance > 0 && s.mortgage_paid_by > s.current_age) {
    const m = mortgageSchedule(s);
    // A mortgage cleared before you stop costs the chart nothing, because the
    // chart starts on the day you stop. Saying "£438,900 to 40" over a line
    // that begins at 41 states a payment the plan never makes.
    facts.push({
      k: 'Mortgage',
      v:
        m.clearAge !== null && m.clearAge <= s.exit_age
          ? `Cleared at ${m.clearAge}`
          : m.clearAge !== null
            ? `${fmtMoney(m.payment)} to ${m.clearAge}`
            : `${fmtMoney(m.payment)}/yr`,
    });
  }
  facts.push({ k: 'Plan until', v: String(s.plan_to) });

  // Tax is reported, not asked for. The three settings behind it are facts of
  // where you live, so the country preset sets them and this shows the result.
  const taxed = res.rows.filter((r) => r.tax > 0);
  if (taxed.length > 0) {
    const avg = taxed.reduce((n, r) => n + r.tax, 0) / taxed.length;
    facts.push({ k: 'Tax', v: `${fmtMoney(avg)}/yr` });
  }

  /*
   * One row.
   *
   * The columns were auto-fit at a 112px minimum, so the count came from
   * whatever width was going and the strip spilled to two rows, then three as
   * soon as a mortgage or a tax line joined. Taking the count straight from
   * the facts pins it to a single row whether there are six of them or eight.
   *
   * Eight across the width this card gets is about 90px each, which is why
   * the label dropped to 11px and both lines refuse to wrap. It is a strip of
   * settings under a heading, not something anyone reads left to right, so it
   * can be small. Held from lg down to a pair on a phone, where eight columns
   * would be shreds.
   */
  const cols = Math.max(1, facts.length);

  return (
    // A thin band, not a section. It sits between a heading and the line it
    // describes and should barely register until you look for it.
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(auto-fit, minmax(110px, 1fr))',
              lg: `repeat(${cols}, minmax(0, 1fr))`,
            },
            columnGap: 1.25,
            rowGap: 1,
            flex: 1,
            minWidth: 0,
          }}
        >
          {facts.map((f) => (
            <Box key={f.k} sx={{ minWidth: 0 }} title={f.t ? `${f.k}, ${f.t}` : undefined}>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'text.tertiary', fontSize: '0.6875rem', lineHeight: 1.25 }}
              >
                {f.k}
              </Typography>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500, lineHeight: 1.25 }}>
                {f.v}
              </Typography>
            </Box>
          ))}
        </Box>

        <Button size="small" startIcon={<TuneIcon />} onClick={onEdit} sx={{ flex: 'none' }}>
          Edit
        </Button>
      </Stack>
    </Box>
  );
}
