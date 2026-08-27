import { useState } from 'react';
import {
  Box, Button, Container, Divider, InputAdornment, Stack,
  TextField, Typography,
} from '@mui/material';
import type { Settings } from '../engine/types';
import { APP_NAME, DEFAULTS, UK } from '../engine/config';
import { currency } from '../engine/format';
import crystalBall from '../assets/emoji/crystal-ball.png';

/**
 * The details screen. Serves two jobs from one form.
 *
 * First run: empty fields, and the answers are folded into DEFAULTS along with
 * a few derived values so nothing opens in a contradictory state.
 *
 * Coming back to edit: every field is prefilled from the current plan and the
 * answers are merged into it, so tuned levers, what-ifs and saved scenarios
 * all survive.
 */

interface Props {
  existing: Settings | null;
  onDone: (settings: Settings) => void;
  onCancel: (() => void) | null;
  onStartOver: () => void;
}

export function Setup({
  existing,
  onDone, onCancel, onStartOver,
}: Props) {
  const editing = existing !== null;
  const str = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(Math.round(n)));

  const [ageNow, setAgeNow] = useState(existing ? String(existing.current_age) : '');
  const [stopAge, setStopAge] = useState(existing ? String(existing.exit_age) : '');
  const [isa, setIsa] = useState(str(existing?.isa_now));
  const [gia, setGia] = useState(str(existing?.gia_now));
  const [other, setOther] = useState(str(existing?.other_now));
  const [pension, setPension] = useState(str(existing?.pension_now));
  const [spend, setSpend] = useState(str(existing?.annual_spend));
  const [isaSave, setIsaSave] = useState(str(existing?.isa_per_year));
  const [giaSave, setGiaSave] = useState(str(existing?.gia_per_year));

  const preset = UK;
  const sym = currency().symbol;


  const num = (v: string, fallback: number) => {
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) && v.trim() !== '' ? n : fallback;
  };

  const base = existing ?? DEFAULTS;
  const currentAge = num(ageNow, base.current_age);
  const exitAge = num(stopAge, base.exit_age);
  const agesValid = exitAge >= currentAge;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agesValid) return;

    const answers = {
      current_age: currentAge,
      exit_age: exitAge,
      isa_now: num(isa, 0),
      gia_now: num(gia, 0),
      other_now: num(other, 0),
      pension_now: num(pension, 0),
      annual_spend: num(spend, base.annual_spend),
      isa_per_year: num(isaSave, 0),
      gia_per_year: num(giaSave, 0),
    };

    const settings: Settings = editing
      ? { ...existing, ...answers, plan_to: Math.max(existing.plan_to, exitAge + 1) }
      : {
          ...DEFAULTS,
          ...answers,
          state_pension: preset.state_pension,
          state_pen_age: preset.state_pen_age,
          pension_access_age: preset.pension_access_age,
          tax_rate: preset.tax_rate,
          tax_allowance: preset.tax_allowance,
          pension_tax_free_pct: preset.pension_tax_free_pct,
          earn_until_age: exitAge,
          plan_to: Math.max(DEFAULTS.plan_to, exitAge + 1),
        };

    onDone(settings);
  }

  const money = (
    id: string, label: string, help: string,
    value: string, set: (v: string) => void, placeholder = '0',
  ) => (
    <TextField
      id={id} label={label} helperText={help} value={value} placeholder={placeholder}
      onChange={(e) => set(e.target.value)}
      fullWidth inputMode="numeric" autoComplete="off"
      slotProps={{ input: { startAdornment: <InputAdornment position="start">{sym}</InputAdornment> } }}
    />
  );

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, sm: 8 } }}>
      <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
        {!editing && (
          <Box
            aria-hidden
            sx={{
              flex: 'none',
              display: { xs: 'none', sm: 'grid' },
              placeItems: 'center',
              width: 88,
              height: 88,
              borderRadius: 3,
              bgcolor: 'primary.light',
            }}
          >
            <Box component="img" src={crystalBall} alt="" sx={{ width: 56, display: 'block' }} />
          </Box>
        )}
        <Box>
          <Typography variant="overline" color="primary">{APP_NAME}</Typography>
          <Typography variant="h1" sx={{ mt: 0.5 }}>
            {editing ? 'Your details' : 'Can you stop working?'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {editing
              ? 'Change anything. Everything else in your plan stays as it is.'
              : 'Eight questions, then a straight answer.'}
          </Typography>
        </Box>
      </Stack>

      <Box component="form" onSubmit={submit} sx={{ mt: 5 }}>
        <Stack spacing={3}>
          <TextField
            label="How old are you?" value={ageNow} onChange={(e) => setAgeNow(e.target.value)}
            placeholder={String(DEFAULTS.current_age)}
            inputMode="numeric" autoComplete="off" sx={{ maxWidth: 220 }}
          />

          <TextField
            label="At what age would you like to stop?" value={stopAge}
            onChange={(e) => setStopAge(e.target.value)}
            error={!agesValid}
            helperText={agesValid ? 'A guess is fine.' : 'That’s before your age now.'}
            placeholder={String(DEFAULTS.exit_age)}
            inputMode="numeric" autoComplete="off" sx={{ maxWidth: 220 }}
          />

          {/*
            * Order matters as much as wording.
            *
            * Spending was fifth of seven, and it is the number the whole
            * answer turns on and the one people find hardest. It goes first
            * now, while the reader is still fresh. "Anything else" was third,
            * which is the vaguest question in the flow asked before anyone
            * had a model of what the tool wanted; it is last, where "have I
            * missed anything" is what you would naturally ask.
            */}
          {money('su-spend', 'What do you spend a year?',
            'What actually leaves your account, after tax, in today’s money. Not counting the mortgage.',
            spend, setSpend, '30,000')}

          {money('su-isa', 'What is in your ISA?',
            'Tax free, and you can reach it any time.', isa, setIsa)}

          {money('su-gia', 'What is in a general account?',
            'Investments outside an ISA or pension. Gains are taxed when you sell.',
            gia, setGia)}

          {money('su-pen', 'What is in your pension?',
            `Locked until ${preset.pension_access_age}.`, pension, setPension)}

          {money('su-isa-save', 'How much do you add to the ISA a year?',
            'Most places cap this. In the UK it’s £20,000.', isaSave, setIsaSave)}

          {money('su-gia-save', 'And to a general account a year?',
            'Whatever you save outside an ISA and outside a pension.', giaSave, setGiaSave)}

          {money('su-other', 'Anything else?',
            'Cash, premium bonds, a savings account. No capital gains tax on these here, so leave out anything whose gains would be taxed.',
            other, setOther)}
        </Stack>

        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mt: 4 }}>
          <Button type="submit" variant="contained" size="large" disabled={!agesValid}>
            {editing ? 'Save details' : 'See the answer'}
          </Button>
          {onCancel && <Button onClick={onCancel}>Cancel</Button>}
          {!editing && (
            <Button onClick={() => onDone(DEFAULTS)}>
              Skip, use example figures
            </Button>
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 5 }} />

      {editing ? (
        <Box>
          <Button color="error" onClick={onStartOver}>Delete everything and start over</Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Clears your plan and saved scenarios. Cannot be undone.
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary" component="div">
          Assumes no work income after you stop.
          <br />
          Stays in your browser. Not financial advice.
        </Typography>
      )}
    </Container>
  );
}
