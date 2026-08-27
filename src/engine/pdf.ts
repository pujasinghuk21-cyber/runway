/**
 * A very small PDF writer.
 *
 * Enough of the format to lay out headings, paragraphs, rules and tables in
 * the three fonts every PDF reader is required to have built in. That is the
 * whole trick: Helvetica, Helvetica-Bold and Helvetica-Oblique need no font
 * file embedded, so a real, selectable, searchable document comes out of
 * about two hundred lines and no dependency.
 *
 * The alternative was jsPDF, which is around 350kB before you add the table
 * plugin, on a site whose entire bundle is smaller than that. Printing the
 * page to PDF from the browser was the other option and it gives you the
 * browser's headers, the browser's margins and whatever the screen happened
 * to be showing.
 *
 * WHAT IT DOES NOT DO: images, embedded fonts, compression, links,
 * transparency. It writes WinAnsi single byte text, so every character has to
 * be in that encoding or be mapped to something that is. Do not reach for
 * this to build a general purpose document; reach for it to print a plan.
 */

/* ── text measurement ───────────────────────────────────────────────────
 *
 * Widths per 1000 units of type size, from the Adobe font metrics for the
 * standard fonts. Needed for anything right aligned or centred, which in a
 * table of money is every column but the first.
 */

const W_REG = ' 278|!278|"355|#556|$556|%889|&667|\'191|(333|)333|*389|+584|,278|-333|.278|/278|0556|1556|2556|3556|4556|5556|6556|7556|8556|9556|:278|;278|<584|=584|>584|?556|@1015|A667|B667|C722|D722|E667|F611|G778|H722|I278|J500|K667|L556|M833|N722|O778|P667|Q778|R722|S667|T611|U722|V667|W944|X667|Y667|Z611|[278|\\278|]278|^469|_556|`333|a556|b556|c500|d556|e556|f278|g556|h556|i222|j222|k500|l222|m833|n556|o556|p556|q556|r333|s500|t278|u556|v500|w722|x500|y500|z500|{334||260|}334|~584';

const W_BOLD = ' 278|!333|"474|#556|$556|%889|&722|\'238|(333|)333|*389|+584|,278|-333|.278|/278|0556|1556|2556|3556|4556|5556|6556|7556|8556|9556|:333|;333|<584|=584|>584|?611|@975|A722|B722|C722|D722|E667|F611|G778|H722|I278|J556|K722|L611|M833|N722|O778|P667|Q778|R722|S667|T611|U722|V667|W944|X667|Y667|Z611|[333|\\278|]333|^584|_556|`333|a556|b611|c556|d611|e556|f333|g611|h611|i278|j278|k556|l278|m889|n611|o611|p611|q611|r389|s556|t333|u611|v556|w778|x556|y556|z500|{389||280|}389|~584';

function widthTable(spec: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of spec.split('|')) out[part[0]] = Number(part.slice(1));
  return out;
}

const WIDTHS = { F1: widthTable(W_REG), F2: widthTable(W_BOLD), F3: widthTable(W_REG) };

export type Font = 'F1' | 'F2' | 'F3';

/**
 * The characters this codebase writes that are not plain ASCII, mapped to
 * their WinAnsi byte. The pound sign is the one that matters; the curly
 * quotes and the en dash are here because the copy uses them and an unmapped
 * character would silently come out as a question mark.
 */
const WINANSI: Record<string, number> = {
  '£': 0xa3, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '…': 0x85, '•': 0x95, '©': 0xa9,
};

/** One byte per character, so a string index is a file offset. */
function encode(text: string): string {
  let out = '';
  for (const ch of text) {
    const mapped = WINANSI[ch];
    if (mapped !== undefined) out += String.fromCharCode(mapped);
    else if (ch.charCodeAt(0) < 256) out += ch;
    else out += '?';
  }
  return out;
}

export function textWidth(text: string, font: Font, size: number): number {
  const t = WIDTHS[font];
  let w = 0;
  for (const ch of encode(text)) w += t[ch] ?? 556;
  return (w * size) / 1000;
}

/** Cut a string to fit, with an ellipsis, so nothing ever overruns a column. */
export function ellipsize(text: string, font: Font, size: number, max: number): string {
  if (textWidth(text, font, size) <= max) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`, font, size) > max) out = out.slice(0, -1);
  return `${out}…`;
}

/** Escape the three characters a PDF string literal cannot hold raw. */
const esc = (s: string) => encode(s).replace(/([\\()])/g, '\\$1');

/* ── the document ───────────────────────────────────────────────────────── */

export const A4 = { w: 595.28, h: 841.89 };

export type Align = 'left' | 'right' | 'center';

export class Pdf {
  private pages: string[] = [];
  private buf = '';

  /** Start a page. Nothing can be drawn before the first call. */
  page(): void {
    if (this.buf) this.pages.push(this.buf);
    this.buf = '';
  }

  /**
   * One line of text, positioned by its baseline.
   *
   * `y` is measured from the top of the page rather than the bottom, because
   * every layout in this file walks down the page and PDF's own origin in the
   * bottom left corner would mean subtracting on every single call.
   */
  text(
    s: string,
    x: number,
    y: number,
    opts: { font?: Font; size?: number; colour?: [number, number, number]; align?: Align; width?: number } = {},
  ): void {
    const font = opts.font ?? 'F1';
    const size = opts.size ?? 10;
    const [r, g, b] = opts.colour ?? [0, 0, 0];
    let tx = x;
    if (opts.align === 'right') tx = x - textWidth(s, font, size);
    else if (opts.align === 'center') tx = x - textWidth(s, font, size) / 2;
    this.buf += `BT ${r} ${g} ${b} rg /${font} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${(A4.h - y).toFixed(2)} Tm (${esc(s)}) Tj ET\n`;
  }

  /**
   * A paragraph, wrapped to a width, returning the y it finished at.
   *
   * Greedy wrapping on spaces. Good enough for four lines of standfirst and
   * not pretending to be anything else.
   */
  paragraph(
    s: string,
    x: number,
    y: number,
    width: number,
    opts: { font?: Font; size?: number; leading?: number; colour?: [number, number, number] } = {},
  ): number {
    const font = opts.font ?? 'F1';
    const size = opts.size ?? 10;
    const leading = opts.leading ?? size * 1.45;
    let line = '';
    let cy = y;
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, font, size) > width && line) {
        this.text(line, x, cy, { font, size, colour: opts.colour });
        cy += leading;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      this.text(line, x, cy, { font, size, colour: opts.colour });
      cy += leading;
    }
    return cy;
  }

  rule(x1: number, y: number, x2: number, colour: [number, number, number] = [0.85, 0.84, 0.87], w = 0.6): void {
    const [r, g, b] = colour;
    this.buf += `${r} ${g} ${b} RG ${w} w ${x1.toFixed(2)} ${(A4.h - y).toFixed(2)} m ${x2.toFixed(2)} ${(A4.h - y).toFixed(2)} l S\n`;
  }

  rect(x: number, y: number, w: number, h: number, colour: [number, number, number]): void {
    const [r, g, b] = colour;
    this.buf += `${r} ${g} ${b} rg ${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
  }

  /**
   * Serialise. Objects are numbered in the order they are written and the
   * cross reference table records where each one starts, which is why every
   * offset here counts bytes and not characters.
   */
  build(title: string): Uint8Array<ArrayBuffer> {
    if (this.buf) this.pages.push(this.buf);
    if (this.pages.length === 0) this.pages.push('');

    const objs: string[] = [];
    const add = (body: string) => objs.push(body);

    const n = this.pages.length;
    // 1 catalog, 2 pages, then n content streams, then n page objects, then 3 fonts.
    const contentIds = this.pages.map((_, i) => 3 + i);
    const pageIds = this.pages.map((_, i) => 3 + n + i);
    const fontIds = [3 + 2 * n, 4 + 2 * n, 5 + 2 * n];

    add(`<< /Type /Catalog /Pages 2 0 R >>`);
    add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${n} >>`);
    for (const c of this.pages) add(`<< /Length ${encode(c).length} >>\nstream\n${c}endstream`);
    for (let i = 0; i < n; i++) {
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] ` +
          `/Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R >> >> ` +
          `/Contents ${contentIds[i]} 0 R >>`,
      );
    }
    for (const base of ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique']) {
      add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`);
    }

    const infoId = objs.length + 1;
    add(`<< /Title (${esc(title)}) /Producer (Runway) /Creator (Runway) >>`);

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(new ArrayBuffer(out.length));
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
