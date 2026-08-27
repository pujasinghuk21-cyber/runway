import { Accordion, AccordionDetails, AccordionSummary, Box, Card, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GrowthIcon from '@mui/icons-material/TrendingUpOutlined';
import type { Settings } from '../engine/types';
import { GROUPS } from '../engine/config';
import { realRate } from '../engine/compute';
import { LeverControl } from './Levers';

/**
 * Growth and inflation.
 *
 * Growth used to be a row in two different time groups, one for the years you
 * work and one for the years after, each label repeating the heading above
 * it. And inflation had no field at all: the engine ran on it and nothing on
 * screen could change it.
 *
 * One rate now. The split was there for people who de-risk at retirement and
 * it cost two near-identical labels and a second number to reconcile, which
 * is more than it bought.
 *
 * Rate and inflation are one sum, so the real rate they produce sits in the
 * header, visible whether the section is open or shut.
 */

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  open: boolean;
  onToggle: () => void;
}

const pct = (n: number) => `${n.toFixed(2)}%`;

export function GrowthCard({ settings: s, onChange, open, onToggle }: Props) {
  const group = GROUPS.find((g) => g.id === 'growth');
  if (!group) return null;

  const real = realRate(s.growth_after, s.inflation) * 100;

  return (
    <Card sx={{ mt: 2 }}>
      {/*
        * No "Undo changes" here, and that is the difference between this card
        * and the tax one next to it.
        *
        * Tax resets to UK statutory figures, which are facts: if you have
        * pulled the allowance around and want the real one back, there is a
        * right answer to go back to. There is no right answer for a growth
        * rate. Resetting would take you to 7.5%, 7% and 2.5%, which are three
        * numbers this tool made up, and offering to restore them dressed a
        * default up as a correction.
        */}
      <Stack direction="row" spacing={1} sx={{ px: 2, pt: 1, pb: 0.5, alignItems: 'center' }}>
        <GrowthIcon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
        <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
          Growth
        </Typography>
      </Stack>

      <Accordion
        expanded={open}
        onChange={onToggle}
        sx={{ bgcolor: 'transparent', borderTop: 1, borderColor: 'divider' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: 'text.tertiary' }} />}>
          <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>
                {`${s.growth_after}% growth, ${s.inflation}% inflation`}
              </Typography>
              {/* The answer, here rather than in a panel below the fields.
                  Repeating it inside was the same two numbers twice. */}
              <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                {`${pct(real)} real`}
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2 }}>
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
