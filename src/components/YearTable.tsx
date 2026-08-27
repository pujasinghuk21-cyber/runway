import {
  Accordion, AccordionDetails, AccordionSummary, Chip, Stack,
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TableIcon from '@mui/icons-material/TableChartOutlined';
import { ExportMenu } from './ExportMenu';
import type { Projection, Settings } from '../engine/types';
import { fmtMoney } from '../engine/format';

/*
 * Both pots, and the total.
 *
 * Start, Growth and End used to mean "money outside the pension" while saying
 * neither. Once the outside pot empties and you are living off the pension,
 * five of the nine columns showed a dash and the row read as a blank year in
 * the middle of the plan. Worse, End disagreed with the chart directly above
 * it: the chart plots both pots, the table showed one.
 *
 * So the pension is a column now, and the total that the chart draws is the
 * last one. Nothing in the arithmetic changed; it was always right and always
 * hidden.
 */
const HEADS = [
  'Age', 'Outside, start', 'Earnings', 'State pension', 'Spend', 'Growth',
  'From pension', 'Tax', 'Outside, end', 'Pension', 'Total',
];

export function YearTable({
  res,
  settings: s,
  planName,
}: {
  res: Projection;
  settings: Settings;
  /** Named in the file, so a download found later says what it was. */
  planName: string;
}) {
  return (
    <Accordion sx={{ bgcolor: 'transparent' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        {/* 8px from the icon to its title, 16px from the title to the count.
            One gap for things that are one thing, a wider one between them. */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
          <TableIcon aria-hidden sx={{ flex: 'none', fontSize: 20, color: 'text.tertiary' }} />
          <Typography variant="h4">Year-by-year detail</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            {res.rows.length} years, {s.exit_age} to {s.plan_to}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Beside the table it exports, and stopping the click from opening
              the accordion underneath it. */}
          <Box
            component="span"
            onClick={(e) => e.stopPropagation()}
            sx={{ flex: 'none', mr: 1, display: 'inline-flex' }}
          >
            <ExportMenu settings={s} name={planName} />
          </Box>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 0 }}>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 900, '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
            <TableHead>
              <TableRow>
                {HEADS.map((h, i) => (
                  <TableCell key={h} align={i === 0 ? 'left' : 'right'}>
                    <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.tertiary' }}>
                      {h}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {res.rows.map((r) => {
                const isUnlock = r.fromPension > 0;
                const isLow = r.age === res.low.age;
                const cell = (v: number) => (v === 0 ? '–' : fmtMoney(v));

                return (
                  <TableRow
                    key={r.age}
                    sx={{
                      bgcolor: isUnlock ? 'primary.light' : isLow ? 'surfaceContainerHigh' : undefined,
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <span>{r.age}</span>
                        {isLow && <Chip size="small" label="low" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{cell(r.start)}</TableCell>
                    <TableCell align="right">{cell(r.earnings)}</TableCell>
                    <TableCell align="right">{cell(r.statePen)}</TableCell>
                    <TableCell align="right" sx={{ color: r.payoff > 0 ? 'error.main' : undefined }}>
                      {fmtMoney(r.spend)}{r.payoff > 0 && ' *'}
                    </TableCell>
                    <TableCell align="right">{cell(r.growth)}</TableCell>
                    <TableCell align="right">{cell(r.fromPension)}</TableCell>
                    <TableCell align="right">{cell(r.tax)}</TableCell>
                    <TableCell align="right" sx={{ color: r.end < 0 ? 'error.main' : undefined }}>
                      {cell(r.end)}
                    </TableCell>
                    <TableCell align="right">{cell(r.pensionEnd)}</TableCell>
                    {/* The one the chart draws. */}
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: r.end + r.pensionEnd < 0 ? 'error.main' : undefined,
                      }}
                    >
                      {fmtMoney(r.end + r.pensionEnd)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
}
