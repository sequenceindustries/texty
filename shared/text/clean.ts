/** Text Cleaner. Each option is an explicit toggle; nothing changes that the user did not switch on. */

export interface CleanOptions {
  /** Turn Windows (\r\n), old Mac (\r) and Unicode line separators into \n. */
  normalizeLineBreaks: boolean;
  /** Remove zero-width characters, soft hyphens and stray control characters; turn non-breaking and other odd spaces into normal spaces. */
  removeInvisible: boolean;
  /** Replace runs of spaces and tabs inside a line with a single space. */
  collapseSpaces: boolean;
  /** Remove spaces and tabs at the start and end of every line. */
  trimLines: boolean;
  /** keep: leave blank lines; collapse: at most one blank line in a row; remove: delete every blank line. */
  blankLines: 'keep' | 'collapse' | 'remove';
  /** Remove whitespace at the very start and end of the text. */
  trimText: boolean;
  /** Curly quotes → straight quotes (off by default; it changes typography). */
  straightenQuotes: boolean;
}

export const DEFAULT_CLEAN: CleanOptions = {
  normalizeLineBreaks: true,
  removeInvisible: true,
  collapseSpaces: true,
  trimLines: true,
  blankLines: 'collapse',
  trimText: true,
  straightenQuotes: false,
};

export interface CleanReport {
  lineBreaks: number;
  invisible: number;
  spaces: number;
  trimmedLines: number;
  blankLines: number;
  quotes: number;
}

export interface CleanResult {
  text: string;
  report: CleanReport;
  changed: boolean;
}

// Zero-width space/joiners, word joiner, BOM, soft hyphen, bidi marks, and C0/C1 controls except tab and newline.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[​‌‍⁠﻿­‎‏‪-‮⁦-⁩\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
// Non-breaking and typographic spaces.
const ODD_SPACES = /[   -   　]/g;

function count(re: RegExp, s: string): number {
  return (s.match(re) ?? []).length;
}

export function cleanText(input: string, opts: CleanOptions): CleanResult {
  const report: CleanReport = { lineBreaks: 0, invisible: 0, spaces: 0, trimmedLines: 0, blankLines: 0, quotes: 0 };
  let t = input;

  if (opts.normalizeLineBreaks) {
    report.lineBreaks = count(/\r\n?|[\u2028\u2029\u0085]/g, t);
    t = t.replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n');
  }
  if (opts.removeInvisible) {
    report.invisible = count(INVISIBLE, t) + count(ODD_SPACES, t);
    // Keep \r if line breaks are not being normalised.
    t = t.replace(INVISIBLE, '').replace(ODD_SPACES, ' ');
  }
  if (opts.straightenQuotes) {
    report.quotes = count(/[“”„‟″‘’‚‛′]/g, t);
    t = t.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'");
  }

  if (opts.collapseSpaces || opts.trimLines || opts.blankLines !== 'keep') {
    const lines = t.split('\n');
    const out: string[] = [];
    let blankRun = 0;
    for (let line of lines) {
      if (opts.trimLines) {
        const trimmed = line.replace(/^[ \t]+|[ \t]+$/g, '');
        if (trimmed !== line && trimmed !== '') report.trimmedLines++;
        line = trimmed;
      }
      if (opts.collapseSpaces) {
        line = line.replace(/([^ \t]|^)[ \t]{2,}/g, (m, pre: string) => {
          // At the start of a line, leading indentation is the trim option's job.
          if (pre === '' && !opts.trimLines) return m;
          report.spaces += m.length - pre.length - 1;
          return pre + ' ';
        });
      }
      const blank = !/[^ \t]/.test(line);
      if (blank) {
        blankRun++;
        if (opts.blankLines === 'remove' || (opts.blankLines === 'collapse' && blankRun > 1)) {
          report.blankLines++;
          continue;
        }
        if (opts.trimLines) line = '';
      } else blankRun = 0;
      out.push(line);
    }
    t = out.join('\n');
  }

  if (opts.trimText) t = t.replace(/^\s+|\s+$/g, '');

  return { text: t, report, changed: t !== input };
}
