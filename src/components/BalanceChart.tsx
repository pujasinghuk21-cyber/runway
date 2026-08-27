import { useMemo, useState } from 'react';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import type { Projection, Settings } from '../engine/types';
import { fmtMoney, fmtShort, niceTicks } from '../engine/format';
import { useMeasure } from '../hooks';

type Anchor = 'start' | 'middle' | 'end';

/**
 * The years worth drawing: everything up to the point the money is gone.
 *
 * Past that the projection keeps subtracting a year of spending from a pot
 * that is empty, so the line marches off the bottom of the chart. On a plan
 * that fails at 50 and runs to 90 that is forty one years of spending money
 * it does not have, and it drew a balance of minus £1.2m as though that were
 * a thing that could happen to someone. It is arithmetic, not a forecast.
 *
 * So the line stops where the money does. The marker says the year, and
 * everything after it is a question the model cannot answer, because what
 * you would actually do is change something.
 */
function drawnRows(res: Projection) {
  if (res.runsOutAge === null) return res.rows;
  return res.rows.filter((r) => r.age <= res.runsOutAge!);
}

interface Props {
  res: Projection;
  baseRes: Projection | null;
  settings: Settings;
  /**
   * What the solid line represents, including the growth rate it assumes.
   *
   * This used to be a sentence floating between the tabs and the chart. It
   * belongs in the legend, which is where everything else about reading the
   * chart is written.
   */
  lineLabel?: string;
  /**
   * A move you are hovering, drawn over the top so you can see what it does
   * before committing to it. Nothing is changed until you apply.
   */
  previewRes?: Projection | null;
  previewLabel?: string;
  /** What the dashed comparison line is. Defaults to the pinned plan. */
  baseLabel?: string;
  /**
   * The plan as it was before you applied anything, drawn underneath.
   *
   * Applying a move used to redraw the one line in place, so the plan you had
   * a second ago was gone and there was nothing to judge the change against.
   * With this present the old line stays put and the current one turns
   * purple, which is the page's mark for something you did.
   */
  beforeRes?: Projection | null;
  beforeLabel?: string;
}

/**
 * Balance by age, in today's money.
 *
 * One line: everything you have, year by year, from the age you stop to the
 * age you are planning for.
 *
 * It briefly carried two series and a shaded band showing the split between
 * spendable and locked money, on top of the milestones, a low-point ring and
 * a pinned comparison. That is three stories at once, and the chart only owes
 * you one: does the money last. The bridge low point is stated in the answer
 * band above, which is a better place for a single figure than a dot.
 *
 * Drawn at the container's true pixel width rather than scaled down from a
 * fixed canvas. The old build authored at 860px and let the browser squash
 * it into a ~660px column, taking every text label down with it.
 */
export function BalanceChart({
  res, baseRes, settings: s, lineLabel = 'This plan', previewRes = null, previewLabel,
  baseLabel = 'Pinned plan', beforeRes = null, beforeLabel = 'Before your changes',
}: Props) {
  const mui = useTheme();
  const [wrapRef, width] = useMeasure<HTMLDivElement>();
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const W = Math.max(320, width || 860);
  const compact = W < 560;
  const H = Math.round(Math.min(460, Math.max(260, W * 0.46)));

  const PL = compact ? 46 : 66;
  const PR = 20;
  const PB = 38;
  const plotW = W - PL - PR;

  /* ── vertical scale ──────────────────────────────────────────────────── */

  const { rows, ageMin, ageMax, vMin, vMax } = useMemo(() => {
    const rs = drawnRows(res);
    const aMin = rs.length ? rs[0].age : s.exit_age;
    // The axis still runs to the end of the plan. A chart that shortened
    // itself when a plan failed would hide how much of the plan is missing.
    const aMax = s.plan_to;

    let lo = Infinity;
    let hi = -Infinity;
    /*
     * Both bounds read the total, because the total is what is drawn.
     *
     * The floor used to read `end` alone, the money outside the pension. On
     * any plan that leans on the pension that runs deeply negative while the
     * line being plotted is still well above zero, so the axis stretched to
     * fit a series nobody could see and squashed the one they could.
     */
    for (const r of rs) {
      const total = r.end + r.pensionEnd;
      if (total < lo) lo = total;
      if (total > hi) hi = total;
      // The reachable line is drawn over the bridge and can go below the
      // total, so the floor has to see it or the failure falls off the chart.
      if (r.age <= s.pension_access_age && r.end < lo) lo = r.end;
    }
    for (const other of [baseRes, previewRes, beforeRes]) {
      if (!other) continue;
      for (const r of drawnRows(other)) {
        if (r.age < aMin || r.age > aMax) continue;
        const total = r.end + r.pensionEnd;
        if (total < lo) lo = total;
        if (total > hi) hi = total;
      }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    lo = Math.min(0, lo);
    hi = Math.max(hi, lo + 1);
    const pad = (hi - lo) * 0.1;
    hi += pad;
    if (lo < 0) lo -= pad;

    return { rows: rs, ageMin: aMin, ageMax: aMax, vMin: lo, vMax: hi };
  }, [res, baseRes, previewRes, beforeRes, s.exit_age, s.plan_to, s.pension_access_age]);

  const X = (a: number) =>
    PL + (ageMax === ageMin ? 0 : (a - ageMin) / (ageMax - ageMin)) * plotW;

  /* ── milestone markers, de-collided ──────────────────────────────────────
     Laid out left to right, dropping to a new row whenever a label would
     overlap the last one placed on that row. The old build had no
     de-collision at all, so close ages printed on top of each other.
     ─────────────────────────────────────────────────────────────────────── */

  const marks = useMemo(() => {
    const candidates = [
      { age: s.pension_access_age, label: 'Pension unlocks' },
      { age: s.state_pen_age, label: 'State pension' },
    ];
    // Derived from the balance and the rate, so the marker cannot disagree
    // with the year the projection actually stops charging for it.
    if (s.mortgage_balance > 0 && res.mortgageClearAge !== null) {
      candidates.push({ age: res.mortgageClearAge, label: 'Mortgage ends' });
    }

    const CHAR_W = 5.9;
    const rowEnds: number[] = [];

    return candidates
      .filter((m) => m.age >= ageMin && m.age <= ageMax)
      .sort((a, b) => a.age - b.age)
      .map((m) => {
        const x = X(m.age);
        const w = `${m.label} ${m.age}`.length * CHAR_W;
        const anchor: Anchor = x > W - 140 ? 'end' : x < PL + 70 ? 'start' : 'middle';
        const left = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
        const right = left + w;

        let row = 0;
        while (rowEnds[row] !== undefined && left < rowEnds[row] + 8) row++;
        rowEnds[row] = right;

        return { ...m, x, anchor, row };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pension_access_age, s.state_pen_age, res.mortgageClearAge, s.mortgage_balance, ageMin, ageMax, plotW, W, PL]);

  const markRows = marks.reduce((n, m) => Math.max(n, m.row + 1), 1);
  const MARK_ROW = 17;
  /** 4px of air above the first row of milestone labels. */
  const MARK_TOP = 16;
  const PT = MARK_TOP + markRows * MARK_ROW;
  const plotH = H - PT - PB;

  const Y = (v: number) => PT + ((vMax - v) / (vMax - vMin)) * plotH;

  const ticks = niceTicks(vMin, vMax, compact ? 4 : 5);
  const pts = rows.map((r) => `${X(r.age).toFixed(1)},${Y(r.end + r.pensionEnd).toFixed(1)}`);

  /*
   * The reachable line, drawn only while the pension is locked and only when
   * it says something the total does not. Once the two are within a rounding
   * error, a second line on top of the first is noise.
   */
  const bridgeRows = rows.filter((r) => r.age <= s.pension_access_age);
  const bridgeDiffers = bridgeRows.some((r) => Math.abs(r.pensionEnd) > 1);
  const bridgePts = bridgeDiffers
    ? bridgeRows.map((r) => `${X(r.age).toFixed(1)},${Y(r.end).toFixed(1)}`)
    : [];
  const zeroLineY = Y(Math.max(0, vMin));

  const stepA = ageMax - ageMin > 40 ? 10 : ageMax - ageMin > 20 ? 5 : 2;
  const xlabs: number[] = [];
  for (let a = ageMin; a <= ageMax; a++) {
    if (a === ageMin || a === ageMax || a % stepA === 0) xlabs.push(a);
  }

  const hoverRow = hoverAge !== null ? rows[hoverAge - ageMin] : undefined;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const svgx = ((e.clientX - r.left) / r.width) * W;
    let age = Math.round(ageMin + ((svgx - PL) / plotW) * (ageMax - ageMin));
    age = Math.max(ageMin, Math.min(ageMax, age));
    if (age !== hoverAge) setHoverAge(age);
  }

  const nudge = (a: Anchor) => (a === 'start' ? 4 : a === 'end' ? -4 : 0);

  return (
    <Box sx={{ position: 'relative', width: '100%' }} ref={wrapRef}>
      <svg
        style={{ display: 'block', width: '100%', height: 'auto', fontFamily: mui.typography.fontFamily }}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Balance from age ${ageMin} to ${ageMax}. Low point ${fmtMoney(res.low.val)} at age ${res.low.age}. Ends at ${fmtMoney(res.endBal)}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverAge(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} y1={Y(t)} x2={W - PR} y2={Y(t)} stroke={mui.palette.divider} strokeWidth="1" />
            <text x={PL - 10} y={Y(t) + 4} textAnchor="end" fontSize="12" fill={mui.palette.text.tertiary}>
              {fmtShort(t)}
            </text>
          </g>
        ))}

        {vMin < 0 && (
          <line
            x1={PL} y1={Y(0)} x2={W - PR} y2={Y(0)}
            stroke={mui.palette.error.main} strokeWidth="1.5" strokeDasharray="3 3"
          />
        )}

        {pts.length > 0 && (
          <path
            d={`M${X(ageMin).toFixed(1)},${zeroLineY.toFixed(1)} L${pts.join(' L')} L${X(ageMax).toFixed(1)},${zeroLineY.toFixed(1)} Z`}
            fill={mui.palette.surfaceContainer}
          />
        )}

        {marks.map((m) => (
          <g key={m.label}>
            <line
              x1={m.x} y1={PT} x2={m.x} y2={PT + plotH}
              stroke={mui.palette.text.tertiary} strokeWidth="1" strokeDasharray="3 4"
            />
            <text
              x={m.x + nudge(m.anchor)} y={MARK_TOP + m.row * MARK_ROW}
              textAnchor={m.anchor} fontSize="11" fill={mui.palette.text.tertiary}
            >
              <tspan fontWeight="500">{m.label}</tspan> {m.age}
            </text>
          </g>
        ))}

        {baseRes && (
          <path
            d={`M${drawnRows(baseRes)
              .filter((r) => r.age >= ageMin && r.age <= ageMax)
              .map((r) => `${X(r.age).toFixed(1)},${Y(r.end + r.pensionEnd).toFixed(1)}`)
              .join(' L')}`}
            fill="none" stroke={mui.palette.text.tertiary} strokeWidth="1.5" strokeDasharray="5 4"
          />
        )}

        {/* What you had before you applied anything. Solid, so it is not
            confused with the pinned plan above, and lighter, because it is
            the thing being departed from rather than the answer. */}
        {beforeRes && (
          <path
            d={`M${drawnRows(beforeRes)
              .filter((r) => r.age >= ageMin && r.age <= ageMax)
              .map((r) => `${X(r.age).toFixed(1)},${Y(r.end + r.pensionEnd).toFixed(1)}`)
              .join(' L')}`}
            fill="none"
            stroke={mui.palette.text.tertiary}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {/*
          * Money you can actually reach, over the bridge years only.
          *
          * The solid line is everything you have, pension included, and
          * during the bridge that is money you are not allowed to touch. On a
          * plan that empties its reachable pot at 52 with a large pension
          * sitting behind glass until 57, the total line sails on and the
          * chart looks healthy while every figure around it says the plan is
          * dead. This is the line that is actually paying for your life until
          * the pension opens.
          */}
        {bridgePts.length > 1 && (
          <path
            d={`M${bridgePts.join(' L')}`}
            fill="none"
            stroke={mui.palette.text.tertiary}
            strokeWidth="1.5"
            strokeDasharray="1 3"
            strokeLinejoin="round"
          />
        )}

        {/* Where it runs dry, named on the chart rather than only in a chip. */}
        {res.runsOutAge !== null && res.runsOutAge >= ageMin && res.runsOutAge <= ageMax && (
          <g>
            <line
              x1={X(res.runsOutAge)} y1={PT} x2={X(res.runsOutAge)} y2={PT + plotH}
              stroke="var(--warn)" strokeWidth="1"
            />
            <circle cx={X(res.runsOutAge)} cy={Y(0)} r="3.5" fill="var(--warn)" />
            <text
              x={X(res.runsOutAge) + 6} y={PT + plotH - 6}
              fontSize="11" fontWeight="500" fill="var(--warn)"
            >
              Runs dry at {res.runsOutAge}
            </text>
          </g>
        )}

        {pts.length > 0 && (
          <path
            d={`M${pts.join(' L')}`}
            fill="none"
            stroke={beforeRes ? mui.palette.primary.main : mui.palette.text.primary}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {previewRes && (
          <path
            d={`M${drawnRows(previewRes)
              .filter((r) => r.age >= ageMin && r.age <= ageMax)
              .map((r) => `${X(r.age).toFixed(1)},${Y(r.end + r.pensionEnd).toFixed(1)}`)
              .join(' L')}`}
            fill="none"
            stroke={mui.palette.primary.main}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {rows.length > 0 && (
          <circle
            cx={X(rows[rows.length - 1].age)}
            cy={Y(rows[rows.length - 1].end + rows[rows.length - 1].pensionEnd)}
            r="3.5"
            fill={beforeRes ? mui.palette.primary.main : mui.palette.text.primary}
          />
        )}

        {/* The age axis: a rule along the foot of the plot, a tick at every
            labelled age, and the label under it. The numbers used to float
            with nothing tying them to the line above. */}
        <line
          x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH}
          stroke={mui.palette.divider} strokeWidth="1"
        />
        {xlabs.map((a) => (
          <g key={a}>
            <line
              x1={X(a)} y1={PT + plotH} x2={X(a)} y2={PT + plotH + 5}
              stroke={mui.palette.divider} strokeWidth="1"
            />
            <text
              x={X(a)} y={PT + plotH + 18}
              textAnchor="middle" fontSize="12" fill={mui.palette.text.tertiary}
            >
              {a}
            </text>
          </g>
        ))}
        <text
          x={W - PR} y={H - 1}
          textAnchor="end" fontSize="10.5" fill={mui.palette.text.tertiary}
        >
          Age
        </text>

        {hoverRow && (
          <g>
            <line x1={X(hoverRow.age)} y1={PT} x2={X(hoverRow.age)} y2={PT + plotH} stroke={mui.palette.primary.main} strokeWidth="1" />
            <circle cx={X(hoverRow.age)} cy={Y(hoverRow.end + hoverRow.pensionEnd)} r="4" fill={mui.palette.primary.main} />
          </g>
        )}
      </svg>

      {hoverRow && (
        <Box
          sx={{
            position: 'absolute', pointerEvents: 'none', zIndex: 2,
            bgcolor: 'text.primary', color: 'background.paper',
            px: 1.25, py: 0.75, borderRadius: '4px', whiteSpace: 'nowrap',
            transform: 'translate(-50%, -115%)',
            left: `${((X(hoverRow.age) / W) * 100).toFixed(2)}%`,
            top: `${((Y(hoverRow.end + hoverRow.pensionEnd) / H) * 100).toFixed(2)}%`,
          }}
        >
          {/* The split, at whatever age you are pointing at. It was a card of
              three fixed moments; the chart already tracks every year. */}
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.4 }}>
            Age {hoverRow.age} · {fmtMoney(hoverRow.end + hoverRow.pensionEnd)}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', lineHeight: 1.4 }}>
            {fmtMoney(Math.max(0, hoverRow.end))} you can reach
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', lineHeight: 1.4 }}>
            {fmtMoney(Math.max(0, hoverRow.pensionEnd))}{' '}
            {hoverRow.age < s.pension_access_age ? 'locked away' : 'still in the pension'}
          </Typography>
        </Box>
      )}

      {/* The legend, and what the line is measuring. That caption used to sit
          in the card header with nothing to attach to; it belongs with the
          other notes on how to read the chart. */}
      <Stack
        direction="row"
        spacing={3}
        useFlexGap
        sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <Key colour={beforeRes ? mui.palette.primary.main : mui.palette.text.primary}>
          {lineLabel}
        </Key>
        {bridgePts.length > 1 && (
          <Key colour={mui.palette.text.tertiary} dashed>
            Money you can reach before {s.pension_access_age}
          </Key>
        )}
        {beforeRes && <Key colour={mui.palette.text.tertiary}>{beforeLabel}</Key>}
        {baseRes && <Key colour={mui.palette.text.secondary} dashed>{baseLabel}</Key>}
        {previewRes && previewLabel && (
          <Key colour={mui.palette.primary.main}>{previewLabel}</Key>
        )}

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
          Everything you have, in today&rsquo;s money
        </Typography>
      </Stack>
    </Box>
  );
}

/** One legend entry. */
function Key({
  colour, dashed, ring, children,
}: {
  colour: string;
  dashed?: boolean;
  ring?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box
        sx={
          ring
            ? { width: 10, height: 10, borderRadius: '50%', border: 2, borderColor: colour }
            : dashed
              ? { width: 18, borderTop: '2px dashed', borderColor: colour }
              : { width: 18, height: 2, bgcolor: colour }
        }
      />
      <Typography variant="caption" sx={{ color: 'text.tertiary' }}>{children}</Typography>
    </Stack>
  );
}
