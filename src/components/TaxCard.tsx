import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartIcon from '@mui/icons-material/RestartAltOutlined';
import TaxIcon from '@mui/icons-material/ReceiptLongOutlined';
import type { Settings } from '../engine/types';
import { GROUPS, UK, DEFAULTS } from '../engine/config';
import { fmtMoney } from '../engine/format';
import { LeverControl } from './Levers';

/**
 * Tax, as its own section rather than a group in the rail.
 *
 * It was hidden entirely for a while, because asking someone for their
 * allowance, their marginal rate and the taxable share of a pension
 * withdrawal is three questions to get one answer they expected the tool to
 * already know. That is still true of setup. It is not true of afterwards:
 * once you have an answer in front of you, the rates behind it are the most
 * interesting thing to push on, and nobody's real situation is a single flat
 * rate. So the country fills them in and this is where you take them apart.
 *
 * Below the plan, not inside it. What is in the rail above are your choices.
 * These are the rules you are playing under, which is a different kind of
 * thing, and putting them in the same stack made them look equally yours.
 *
 * Collapsed by default. Seven more fields in an already tall rail is how the
 * scroll started cutting content the last time.
 */

/** The tax settings a country decides for you. Anything else falls back to DEFAULTS. */
const FROM_COUNTRY = [
  'tax_rate', 'tax_allowance', 'pension_tax_free_pct',
  'cgt_rate', 'cgt_allowance', 'isa_allowance',
] as const;

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  open: boolean;
  onToggle: () => void;
}

export function TaxCard({ settings: s, onChange, open, onToggle }: Props) {
  const group = GROUPS.find((g) => g.id === 'tax');
  if (!group) return null;


  /** What each field would be if you had never touched it. */
  const original = (k: keyof Settings): number =>
    (FROM_COUNTRY as readonly string[]).includes(k as string)
      ? (UK[k as (typeof FROM_COUNTRY)[number]] as number)
      : (DEFAULTS[k] as number);

  const touched = group.items.some((l) => s[l.k] !== original(l.k));

  const reset = () => {
    const patch: Partial<Settings> = {};
    for (const l of group.items) (patch as Record<string, number>)[l.k] = original(l.k);
    onChange(patch);
  };

  /* Enough of the answer to be worth reading with the section shut. */
  const summary = [
    `${s.tax_rate}% above ${fmtMoney(s.tax_allowance)}`,
    s.cgt_rate > 0 ? `${s.cgt_rate}% on gains` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card sx={{ mt: 2 }}>
      <Stack
        direction="row"
        sx={{ px: 2, pt: 1, pb: 0.5, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TaxIcon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
          <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
            Tax
          </Typography>
        </Stack>
        {/* Always here, greyed until there is something to go back from.
            Appearing only once you had changed something meant the way out
            was invisible at the moment you were deciding whether to touch
            anything, and the header changed height under you when you did. */}
        <Button
          size="small"
          startIcon={<RestartIcon />}
          onClick={reset}
          disabled={!touched}
          sx={{ mr: -1 }}
        >
          Undo changes
        </Button>
      </Stack>

      <Accordion
        expanded={open}
        onChange={onToggle}
        sx={{ bgcolor: 'transparent', borderTop: 1, borderColor: 'divider' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: 'text.tertiary' }} />}>
          <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>
                Rates and allowances
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                {summary}
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2 }}>
          {/* Said here rather than in the header, because it only matters
              once you have opened the thing to change something. */}
          <Typography
            variant="caption"
            sx={{ color: 'text.tertiary', display: 'block', lineHeight: 1.4, mb: 1.5 }}
          >
            UK rules as of August 2026, and they change every April. Change any of it.
          </Typography>

          {/* Config order, not the rail's sort. The allowance has to sit
              directly above the rate that applies past it, and the gains rate
              above the gains that escape it. Sorting by control shape split
              both pairs. */}
          <Stack spacing={1}>
            {group.items.map((item) => (
              <LeverControl key={item.k} lever={item} settings={s} onChange={onChange} hintOnHover />
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Card>
  );
}
