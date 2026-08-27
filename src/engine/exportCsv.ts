import type { Projection, Settings } from './types';
import { APP_NAME } from './config';
import { planData } from './planData';

/**
 * The plan as a spreadsheet.
 *
 * CSV rather than a real .xlsx file, and that is a choice rather than a
 * shortcut. Writing xlsx needs a library around half a megabyte, which is
 * more than this entire app, for a format Excel opens no more happily than
 * this one. Numbers, Sheets and every other spreadsheet open it too.
 *
 * Every figure goes out as a bare number: no pound signs, no thousands
 * separators, no percent signs. A spreadsheet you cannot add up is a picture
 * of a spreadsheet. The units are in the column headings instead.
 *
 * Three blocks in one file, separated by blank lines, which every spreadsheet
 * handles: what you told it, what it worked out, then the years. Without the
 * first, a year table found six months later is a set of numbers with no idea
 * what question they were answering.
 *
 * What goes in the file is decided in `planData`, shared with the PDF, so the
 * two documents cannot end up describing the same plan differently.
 */

/** Wrap anything that would confuse a comma-separated line. */
function cell(v: string | number): string {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const row = (...cells: (string | number)[]) => cells.map(cell).join(',');

export function planToCsv(s: Settings, res: Projection, name: string): string {
  const d = planData(s, res, name);
  const lines: string[] = [];

  lines.push(row(APP_NAME, d.title));
  lines.push(row('Exported', d.exported));
  lines.push(row('All figures in', "today's money, before inflation is added back"));
  lines.push('');

  lines.push(row('What you told it', 'Value', 'Unit'));
  for (const f of d.inputs) lines.push(row(f.k, f.v, f.unit));
  lines.push('');

  lines.push(row('What it worked out', 'Value', 'Unit'));
  for (const f of d.derived) lines.push(row(f.k, f.v, f.unit));
  lines.push('');

  // The unit goes in the heading, because the cells have to stay addable.
  lines.push(row(...d.columns.map((c, i) => (i === 0 ? c : `${c} (GBP)`))));
  for (const r of d.rows) lines.push(row(...r));

  return lines.join('\n');
}

/** A BOM, so Excel reads it as UTF-8 and does not mangle the pound signs. */
export const csvBlob = (text: string) => `﻿${text}`;
