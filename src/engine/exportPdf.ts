import type { Projection, Settings } from './types';
import { APP_NAME, APP_TAGLINE } from './config';
import { planData, type Fact } from './planData';
import { Pdf, A4, ellipsize, textWidth } from './pdf';

/**
 * The plan as something you can print, email, or put in front of a mortgage
 * adviser.
 *
 * The spreadsheet is for arguing with the numbers. This is for reading them:
 * the answer first, then what it was told, then what it worked out, then
 * every year of it. Six months from now the year table on its own is a grid
 * of numbers with no idea what question it was answering, so the settings
 * travel with it and so does the date.
 */

/* ── the page ────────────────────────────────────────────────────────────
 * A4 with a 48pt margin, which at this measure gives about 90 characters a
 * line in the body size. Wider than that and prose gets hard to track back.
 */
const M = 48;
const RIGHT = A4.w - M;
const WIDTH = RIGHT - M;
const FOOT = A4.h - 40;

const INK: [number, number, number] = [0.11, 0.106, 0.122];
const MUTED: [number, number, number] = [0.388, 0.376, 0.42];
const BRAND: [number, number, number] = [0.353, 0.247, 0.627];
const RULE: [number, number, number] = [0.855, 0.847, 0.875];
const BAND: [number, number, number] = [0.965, 0.961, 0.973];

const money = (n: number) =>
  `${n < 0 ? '-' : ''}£${Math.abs(Math.round(n)).toLocaleString('en-GB')}`;

/** A figure for a table cell: money, an age, or a word like "never". */
function cellText(v: number | string, unit: string): string {
  if (typeof v === 'string') return v;
  if (unit === 'GBP' || unit === 'GBP a year') return money(v);
  if (unit.startsWith('%')) return `${v}%`;
  return String(v);
}

export function planToPdf(s: Settings, res: Projection, name: string): Uint8Array<ArrayBuffer> {
  const d = planData(s, res, name);
  const pdf = new Pdf();

  let page = 1;
  const startPage = () => {
    pdf.page();
    // The mark, drawn as the two shapes it is rather than imported: a rounded
    // tile is not worth an image and this way it takes the brand colour.
    pdf.rect(M, 44, 14, 14, BRAND);
    pdf.text(APP_NAME, M + 20, 55, { font: 'F2', size: 10, colour: INK });
    pdf.text(d.title, RIGHT, 55, { size: 9, colour: MUTED, align: 'right' });
    pdf.rule(M, 64, RIGHT);
    return 96;
  };

  const endPage = (total: number) => {
    pdf.rule(M, FOOT - 12, RIGHT);
    pdf.text(
      'Figures in today’s money. An estimate from the numbers you gave, not financial advice.',
      M,
      FOOT,
      { size: 8, colour: MUTED },
    );
    pdf.text(`${page} of ${total}`, RIGHT, FOOT, { size: 8, colour: MUTED, align: 'right' });
  };

  /*
   * Pages are counted before anything is drawn, because the footer says "1 of
   * 4" and cannot know the 4 unless it is worked out first. Twelve point rows
   * on a 620pt column is 34 to a page after the heading.
   */
  const PER_PAGE = 50;
  const total = 1 + Math.max(1, Math.ceil(d.rows.length / PER_PAGE));

  /* ── page one, the answer ───────────────────────────────────────────── */

  let y = startPage();

  pdf.text(d.title, M, y, { font: 'F2', size: 24, colour: INK });
  y += 22;
  pdf.text(`${APP_TAGLINE}. Saved ${d.exported}.`, M, y, { size: 10, colour: MUTED });
  y += 34;

  /*
   * Four figures across the top, because these are the ones someone opens the
   * file to find. Everything below is the working.
   */
  /*
   * The fourth figure has to be a different fact from the second, or the card
   * says the same number twice. When the plan holds, "lasts to 90" and "left
   * at 90" are two things. When it fails, "lasts to 52" and "runs dry at 52"
   * are one thing said twice, so the fourth becomes the size of the gap.
   */
  const bust = res.runsOutAge !== null;
  const headline: [string, string][] = [
    ['You stop at', String(s.exit_age)],
    ['Money lasts to', bust ? String(res.runsOutAge) : String(s.plan_to)],
    ['Pot when you stop', money(res.total0)],
    bust
      ? ['Years short', String(s.plan_to - (res.runsOutAge as number))]
      : [`Left at ${s.plan_to}`, money(res.endBal)],
  ];

  pdf.rect(M, y - 16, WIDTH, 62, BAND);
  const colW = WIDTH / 4;
  headline.forEach(([k, v], i) => {
    const x = M + 14 + i * colW;
    pdf.text(k.toUpperCase(), x, y + 2, { size: 7.5, colour: MUTED });
    pdf.text(v, x, y + 26, { font: 'F2', size: 19, colour: bust && i === 3 ? [0.63, 0.16, 0.12] : INK });
  });
  y += 74;

  if (res.runsOutAge !== null) {
    y = pdf.paragraph(
      `On these numbers the money runs out at ${res.runsOutAge}, which is ${s.plan_to - res.runsOutAge} years short of where the plan ends. The year it happens is in the table.`,
      M,
      y,
      WIDTH,
      { size: 10.5, colour: INK },
    ) + 12;
  }

  /* ── what you told it ───────────────────────────────────────────────── */

  const facts = (heading: string, list: Fact[], y0: number): number => {
    let cy = y0;
    pdf.text(heading, M, cy, { font: 'F2', size: 12, colour: INK });
    cy += 8;
    pdf.rule(M, cy, RIGHT, RULE, 1);
    cy += 16;
    for (const f of list) {
      pdf.text(ellipsize(f.k, 'F1', 9.5, WIDTH - 130), M, cy, { size: 9.5, colour: INK });
      pdf.text(cellText(f.v, f.unit), RIGHT, cy, { size: 9.5, colour: INK, align: 'right' });
      cy += 14.5;
    }
    return cy + 14;
  };

  /*
   * Two columns, because thirty six settings down one column is two pages of
   * a document whose whole point is to be scannable. Split at the halfway
   * mark and laid out as two independent lists side by side.
   */
  pdf.text('What you told it', M, y, { font: 'F2', size: 12, colour: INK });
  y += 8;
  pdf.rule(M, y, RIGHT, RULE, 1);
  y += 16;

  const half = Math.ceil(d.inputs.length / 2);
  const cols = [d.inputs.slice(0, half), d.inputs.slice(half)];
  const gutter = 24;
  const cw = (WIDTH - gutter) / 2;
  cols.forEach((list, ci) => {
    const x0 = M + ci * (cw + gutter);
    let cy = y;
    for (const f of list) {
      const value = cellText(f.v, f.unit);
      const vw = textWidth(value, 'F1', 9);
      pdf.text(ellipsize(f.k, 'F1', 9, cw - vw - 12), x0, cy, { size: 9, colour: MUTED });
      pdf.text(value, x0 + cw, cy, { size: 9, colour: INK, align: 'right' });
      cy += 14;
    }
  });
  y += half * 14 + 20;

  y = facts('What it worked out', d.derived, y);

  endPage(total);

  /* ── the year table ─────────────────────────────────────────────────── */

  /*
   * Eleven columns on 500pt is 45pt each, which fits a seven figure sum at
   * 7.5pt and nothing larger. Age gets less because it is two digits.
   */
  const size = 7.5;
  const ageW = 26;
  const numW = (WIDTH - ageW) / (d.columns.length - 1);
  const rowH = 12.2;

  /*
   * Headings over two lines, because they do not fit on one and cutting them
   * to "Reachabl…" makes a column nobody can identify. Split by hand rather
   * than wrapped, so the break lands where the sense does.
   */
  const HEAD_LINES: Record<string, [string, string]> = {
    'Age': ['', 'Age'],
    'Reachable at start': ['Reachable', 'at start'],
    'Work income': ['Work', 'income'],
    'State pension': ['State', 'pension'],
    'Spending': ['', 'Spending'],
    'Growth': ['', 'Growth'],
    'From pension': ['From', 'pension'],
    'Tax': ['', 'Tax'],
    'Reachable at end': ['Reachable', 'at end'],
    'Pension at end': ['Pension', 'at end'],
    'Total': ['', 'Total'],
  };

  const tableHead = (y0: number): number => {
    pdf.text('Year by year', M, y0, { font: 'F2', size: 12, colour: INK });
    let cy = y0 + 8;
    pdf.rule(M, cy, RIGHT, RULE, 1);
    cy += 15;
    d.columns.forEach((c, i) => {
      const [top, bottom] = HEAD_LINES[c] ?? ['', c];
      const x = i === 0 ? M : M + ageW + i * numW - 2;
      const align = i === 0 ? 'left' : 'right';
      if (top) pdf.text(top, x, cy, { font: 'F2', size, colour: MUTED, align });
      pdf.text(bottom, x, cy + 9, { font: 'F2', size, colour: MUTED, align });
    });
    cy += 14;
    pdf.rule(M, cy, RIGHT, RULE, 0.8);
    return cy + 12;
  };

  page = 2;
  y = startPage();
  y = tableHead(y);

  let drawn = 0;
  for (const row of d.rows) {
    if (drawn > 0 && drawn % PER_PAGE === 0) {
      endPage(total);
      page += 1;
      y = startPage();
      y = tableHead(y);
    }

    const age = Number(row[0]);
    // The year the pension opens and the year it runs dry are the two rows
    // anyone scanning this is looking for, so they are banded rather than
    // left to be counted down to.
    const isRuin = res.runsOutAge !== null && age === res.runsOutAge;
    const isUnlock = age === s.pension_access_age;
    if (isRuin) pdf.rect(M, y - 8.5, WIDTH, rowH, [0.98, 0.92, 0.91]);
    else if (isUnlock) pdf.rect(M, y - 8.5, WIDTH, rowH, [0.93, 0.91, 0.97]);
    else if (drawn % 2 === 1) pdf.rect(M, y - 8.5, WIDTH, rowH, BAND);

    row.forEach((v, i) => {
      if (i === 0) {
        pdf.text(String(v), M + 2, y, { font: isUnlock || isRuin ? 'F2' : 'F1', size, colour: INK });
      } else {
        const x = M + ageW + i * numW - 2;
        const n = Number(v);
        pdf.text(n === 0 ? '–' : money(n), x, y, {
          size,
          colour: n < 0 ? [0.63, 0.16, 0.12] : i === row.length - 1 ? INK : MUTED,
          font: i === row.length - 1 ? 'F2' : 'F1',
          align: 'right',
        });
      }
    });

    y += rowH;
    drawn += 1;
  }

  endPage(total);
  return pdf.build(`${APP_NAME} plan: ${d.title}`);
}
