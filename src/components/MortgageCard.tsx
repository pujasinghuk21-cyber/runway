import { Accordion, AccordionDetails, AccordionSummary, Box, Card, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import { LeverControl } from './Levers';
import { mortgageSchedule } from '../engine/compute';
import { fmtMoney } from '../engine/format';
import type { Lever } from '../engine/config';
import type { Settings } from '../engine/types';

/**
 * A mortgage calculator, the ordinary kind.
 *
 * What you owe, the rate, how long is left. The payment falls out of those
 * three, the way it does on any lender's website, and the total interest
 * falls out of the payment. Nothing here is a strategy or a what-if; it is
 * the loan you already have, described.
 *
 * The offset fund is the one lever, and it is left blank because most people
 * do not have one. Money parked there stops interest accruing without cutting
 * the payment, so the same payment clears the debt sooner. That is the whole
 * mechanism and it needs no explaining beyond watching the year move.
 */

const FACTS: Lever[] = [
  {
    k: 'mortgage_balance',
    label: 'How much you owe',
    kind: 'money',
    min: 0,
    max: (s) => Math.max(s.mortgage_balance * 2, 600_000),
    step: 1_000,
  },
  {
    k: 'mortgage_rate',
    label: 'Rate',
    hint: 'what your lender charges, before inflation',
    kind: 'pct',
    min: 0,
    max: 15,
    step: 0.05,
  },
  {
    k: 'mortgage_paid_by',
    label: 'Paid off by age',
    hint: 'what your lender says, or bring it forward to see what paying it off faster costs',
    kind: 'age',
    min: (s) => s.current_age,
    max: 100,
    step: 1,
  },
  {
    k: 'mortgage_offset',
    label: 'Offset fund',
    hint: 'linked savings you’re not charged interest on. Leave blank if you have none.',
    kind: 'money',
    min: 0,
    max: (s) => Math.max(s.mortgage_balance, 100_000),
    step: 1_000,
    problem: (s) =>
      s.mortgage_offset > s.mortgage_balance
        ? 'More than you owe. Anything above the balance does nothing.'
        : null,
  },
];

export function MortgageCard({
  settings: s,
  onChange,
  open,
  onToggle,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const m = mortgageSchedule(s);
  const has = s.mortgage_balance > 0 && s.mortgage_paid_by > s.current_age;

  return (
    <Card sx={{ mt: 2 }}>
      {/* The icon belongs to the card, not to the figure.
          Sitting beside the summary it read as a bullet on one number, and
          the card's own name had nothing to identify it. Up here it labels
          the section, and everything below it is one text column starting at
          the same left edge as the fields. */}
      <Stack direction="row" spacing={1} sx={{ px: 2, pt: 1, pb: 0.5, alignItems: 'center' }}>
        <HomeIcon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
        <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
          Mortgage
        </Typography>
      </Stack>

      <Accordion
        expanded={open}
        onChange={onToggle}
        sx={{ bgcolor: 'transparent', borderTop: 1, borderColor: 'divider' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: 'text.tertiary' }} />}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
              {has ? `${fmtMoney(m.payment)} a year` : 'None'}
            </Typography>
            {/* What you owe, not when it clears. The clearing age is derived
                from the three fields below and belongs with the rest of the
                answer at the foot of the card, where it already was. It was
                in both places. */}
            {has && (
              <Typography variant="caption" sx={{ color: 'text.tertiary', lineHeight: 1.3 }}>
                {`${fmtMoney(s.mortgage_balance)} at ${s.mortgage_rate}%`}
              </Typography>
            )}
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2, pb: 2 }}>
          <Stack spacing={1}>
            {FACTS.map((l) => (
              <LeverControl key={l.k} lever={l} settings={s} onChange={onChange} hintOnHover />
            ))}
          </Stack>

          {/* What the three facts come to. The payment is the answer people
              come to a mortgage calculator for; the interest is the one they
              did not ask for and should see. */}
          {has && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Row label="You pay" value={`${fmtMoney(m.payment)} a year`} strong />
              <Row
                label="Paid off at"
                value={m.clearAge !== null ? String(m.clearAge) : 'after the plan ends'}
              />
              <Row label="Interest, in total" value={fmtMoney(m.interest)} />
              {s.mortgage_offset > 0 && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.tertiary', display: 'block', mt: 0.75, lineHeight: 1.35 }}
                >
                  The offset does not change the payment. It stops interest, so the same payment
                  clears it sooner.
                </Typography>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" sx={{ color: strong ? 'text.primary' : 'text.tertiary' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 600 : 400,
          fontVariantNumeric: 'tabular-nums',
          color: strong ? 'text.primary' : 'text.secondary',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
