import {
  Accordion, AccordionDetails, AccordionSummary, Box, Card, Grid, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpIcon from '@mui/icons-material/HelpOutlineOutlined';
import { mortgageCostAt, realRate, savingPerYear } from '../engine/compute';
import { APP_NAME } from '../engine/config';
import { fmtMoney } from '../engine/format';
import type { Settings } from '../engine/types';

/**
 * What the words mean, and what the tool takes for granted.
 *
 * TWO KINDS OF THING, KEPT APART. A glossary is not an assumption. They sat
 * in one list under one heading, and the difference between "here is what
 * this word means" and "here is something we are pretending is true" is the
 * whole value of the second one.
 *
 * AN ASSUMPTION IS SOMETHING YOU DID NOT TELL IT. Most of these used to lead
 * with a setting read back: "10% while you work, 10% after, inflation 3%",
 * "The pension is locked until 57", "£12,000 a year until 41". Those are not
 * assumptions, they are the left hand rail with a different label on it, and
 * filing them under "what it takes for granted" made the real assumptions
 * harder to find rather than easier.
 *
 * So every bold line is now a thing the tool decided on your behalf, and your
 * own numbers sit underneath it as the consequence. "Saving stops the day you
 * stop working" is an assumption. "£12,000 a year until 41" is a setting. The
 * first is the claim, the second is what it does to you.
 *
 * Your numbers go in either way. An assumption in the abstract is something
 * you nod at; the same assumption with your £26,000 in it is something you
 * check.
 */

interface Term {
  term: string;
  meaning: string;
}

interface Assumption {
  /** The thing taken for granted. Always the tool's choice, never yours. */
  claim: string;
  /** What it does to this plan, in your numbers, or why it is wrong. */
  detail?: string;
}

export function AssumptionsPage({ settings: s }: { settings: Settings }) {
  const mortgageNow = mortgageCostAt(s, s.exit_age);
  const saved = savingPerYear(s) + s.pension_per_year;
  const bridge = Math.max(0, s.pension_access_age - s.exit_age);

  const terms: Term[] = [
    { term: 'Today’s money', meaning: 'Every figure is what it would buy now. Nothing on screen is inflated.' },
    { term: 'Real', meaning: 'A rate with inflation already taken off. Your growth becomes real inside the engine.' },
    { term: 'The bridge', meaning: `The years between stopping and your pension opening. Yours is ${bridge} years, ${s.exit_age} to ${s.pension_access_age}.` },
    { term: 'Reachable', meaning: 'Anything you can spend today: ISA, general account, Other. Not the pension.' },
    { term: 'General account', meaning: 'Investments outside an ISA or pension. Gains are taxed when you sell.' },
    { term: 'Profit so far', meaning: 'How much of your general account is gain rather than your own money. Only the gain is taxed.' },
    { term: 'Bed and ISA', meaning: 'Selling from a general account and rebuying inside an ISA, to get it out of tax’s way.' },
    { term: 'Offset', meaning: 'Savings linked to a mortgage. You’re not charged interest on them, so the debt clears sooner.' },
    { term: 'Runs dry', meaning: 'The first year the money you can reach goes below zero.' },
    { term: 'Ceiling', meaning: 'The most you could spend each year with the money still lasting.' },
  ];

  const sections: { title: string; notes: Assumption[] }[] = [
    {
      title: 'Spending',
      notes: [
        {
          claim: 'You spend the same amount every year, for life.',
          detail: 'Nobody does. Being able to cut back in a bad year is worth more than almost any lever here, and none of that flexibility is in the answer.',
        },
        {
          claim: 'The mortgage is added to your spending, not counted inside it.',
          detail:
            mortgageNow > 0
              ? `So ${fmtMoney(s.annual_spend + mortgageNow)} a year for the years the mortgage runs, then ${fmtMoney(s.annual_spend)}.`
              : s.mortgage_balance > 0
                ? 'Yours is gone before you stop, so it costs this plan nothing.'
                : 'Add one and its payment is worked out separately and put on top.',
        },
        {
          claim: 'Until you stop, the mortgage comes out of your salary.',
          detail: 'So the amount you save each year should be what is left after paying it. Neither your salary nor the payments before you stop are in the model, and they cancel. After you stop there is no salary, so it comes out of the pot instead.',
        },
        { claim: 'No care costs, no house sale, no inheritance.' },
      ],
    },
    {
      title: 'Growth',
      notes: [
        {
          claim: 'The same return every single year.',
          detail: 'The biggest gap between this and reality. Bad years early do far more damage than the same years late, and none of that is here.',
        },
        {
          claim: 'The growth you type is before inflation, and gets converted.',
          detail: `${s.growth_after}% with ${s.inflation}% inflation leaves ${(realRate(s.growth_after, s.inflation) * 100).toFixed(2)}% real, and that is what the projection compounds.`,
        },
        { claim: 'No platform charges and no fund fees.', detail: 'Take yours off the growth rate before you type it.' },
      ],
    },
    {
      title: 'Accounts',
      notes: [
        {
          claim: 'Nothing comes out of the pension before the age you set.',
          detail: `Yours opens at ${s.pension_access_age}, so the ${bridge} years from ${s.exit_age} come out of everything else.`,
        },
        { claim: 'Money is spent in the order that costs least tax.', detail: 'Income first, then what you can reach, then the pension.' },
        {
          claim: 'An ISA and Other are tax free. A general account is not.',
          detail: `${s.assumed_gain_pct}% of yours is profit today, and that share grows, so the tax bill rises over the plan.`,
        },
        { claim: 'Withdrawals come out of every account in proportion.', detail: 'A real person would choose, and the order changes the tax.' },
      ],
    },
    {
      title: 'Tax',
      notes: [
        {
          claim: 'One income tax rate, with no bands above it.',
          detail: `Yours is ${s.tax_rate}% above ${fmtMoney(s.tax_allowance)}. No higher rate, no National Insurance, no allowance taper. Above about £50,000 of taxable income it understates the bill.`,
        },
        { claim: 'Allowances keep their value forever.', detail: 'In reality they get frozen, which raises tax quietly every year.' },
        { claim: 'UK rules as they stand in August 2026.', detail: 'They change every April.' },
      ],
    },
    {
      title: 'Saving',
      notes: [
        { claim: 'Saving stops the day you stop working.', detail: `Your ${fmtMoney(saved)} a year runs to ${s.exit_age}, then nothing.` },
        { claim: 'What you save arrives evenly through the year.', detail: 'So it earns about half a year of growth rather than a full year or none.' },
        { claim: 'No pay rises.' },
        { claim: 'No tax relief on pension contributions.', detail: 'What you type is what lands, which makes a pension look worse than it is against an ISA.' },
        { claim: 'The state pension never changes.', detail: `Yours is ${fmtMoney(s.state_pension)} from ${s.state_pen_age}, flat in today’s money for the rest of the plan.` },
      ],
    },
  ];

  /*
   * The section header carries a light fill and the content sits on the card
   * below it. Six identical rows of text with only a chevron between them is
   * a list, not a set of sections. The fill is one step off white, which is
   * enough to group and not enough to compete with anything on the page.
   */
  const summarySx = {
    px: 2,
    minHeight: 46,
    bgcolor: 'surfaceContainer',
    borderTop: 1,
    borderColor: 'divider',
    '&.Mui-expanded': { minHeight: 46 },
    '& .MuiAccordionSummary-content, & .MuiAccordionSummary-content.Mui-expanded': { my: 1 },
  } as const;

  const groups: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Terminology',
      body: (
        <Grid container spacing={{ xs: 0, md: 3 }}>
          {terms.map((t) => (
            <Grid size={{ xs: 12, md: 6 }} key={t.term}>
              <Box sx={{ py: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t.term}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.tertiary', lineHeight: 1.4 }}>
                  {t.meaning}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      ),
    },
    ...sections.map((sec) => ({
      title: sec.title,
      body: (
        <Stack spacing={1.75}>
          {sec.notes.map((n) => (
            <Box key={n.claim}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
                {n.claim}
              </Typography>
              {n.detail && (
                <Typography
                  variant="body2"
                  sx={{ color: 'text.tertiary', lineHeight: 1.4, mt: 0.25 }}
                >
                  {n.detail}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      ),
    })),
  ];

  return (
    <Card sx={{ mt: 2 }}>
      {/*
        * The whole thing closes.
        *
        * It was a heading with six collapsed sections beneath it, so the card
        * stood a foot tall at the bottom of the plan whether or not anybody
        * wanted it. This is reference material. It should take one row until
        * it is asked for, and the row that opens it needs its own chevron.
        */}
      {/* Built to match the year table directly above it: default gutters,
          default chevron, the same 8px icon-to-title and 16px title-to-note.
          It was indented 24px with a 20px chevron, so both ends of the row
          were off the grid its neighbour sits on. */}
      <Accordion sx={{ bgcolor: 'transparent' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <HelpIcon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
            <Typography variant="h4">How it works</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              What the words mean, and what {APP_NAME} takes for granted
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails sx={{ p: 0 }}>
          {groups.map((g) => (
            <Accordion key={g.title} disableGutters sx={{ bgcolor: 'transparent' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: 'text.tertiary' }} />}
                sx={summarySx}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {g.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 2, pb: 2.25 }}>
                {g.body}
              </AccordionDetails>
            </Accordion>
          ))}
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}
