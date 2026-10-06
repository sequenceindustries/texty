/** Line tools: Remove Duplicate Lines and Sort Lines. */

export function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split(/\r\n|\r|\n/);
}

// ---------- Remove duplicate lines ----------

export interface DedupeOptions {
  keep: 'first' | 'last';
  caseSensitive: boolean;
  /** Treat "apple" and "  apple " as the same line. The kept line is trimmed too. */
  ignoreWhitespace: boolean;
  /** Keep the original order; otherwise the result is sorted A → Z. */
  preserveOrder: boolean;
  /** Drop blank lines entirely (otherwise a blank line counts as a line like any other). */
  removeBlank: boolean;
}

export const DEFAULT_DEDUPE: DedupeOptions = {
  keep: 'first',
  caseSensitive: true,
  ignoreWhitespace: true,
  preserveOrder: true,
  removeBlank: false,
};

export interface LinesResult {
  text: string;
  before: number;
  after: number;
}

export function removeDuplicateLines(text: string, o: DedupeOptions): LinesResult {
  const lines = splitLines(text);
  const key = (l: string) => {
    let k = o.ignoreWhitespace ? l.trim() : l;
    if (!o.caseSensitive) k = k.toLocaleLowerCase();
    return k;
  };
  const seen = new Map<string, number>(); // key → index of kept line
  const kept: (string | null)[] = [];
  for (const raw of lines) {
    const line = o.ignoreWhitespace ? raw.trim() : raw;
    if (o.removeBlank && line.trim() === '') continue;
    const k = key(raw);
    const prev = seen.get(k);
    if (prev === undefined) {
      seen.set(k, kept.length);
      kept.push(line);
    } else if (o.keep === 'last') {
      // Drop the earlier occurrence; the line takes the later position.
      kept[prev] = null;
      seen.set(k, kept.length);
      kept.push(line);
    }
  }
  let out = kept.filter((l): l is string => l !== null);
  if (!o.preserveOrder) out = out.sort(collator(o.caseSensitive).compare);
  return { text: out.join('\n'), before: lines.length, after: out.length };
}

// ---------- Sort lines ----------

export const SORTS = [
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
  { id: 'num-asc', label: 'Numbers 1 → 9' },
  { id: 'num-desc', label: 'Numbers 9 → 1' },
  { id: 'short', label: 'Shortest first' },
  { id: 'long', label: 'Longest first' },
  { id: 'reverse', label: 'Reverse order' },
  { id: 'random', label: 'Shuffle' },
] as const;
export type SortId = (typeof SORTS)[number]['id'];

export interface SortOptions {
  mode: SortId;
  caseSensitive: boolean;
  /** remove: drop blank lines; end: move them to the end; keep: sort them like other lines. */
  blankLines: 'remove' | 'end' | 'keep';
}

export const DEFAULT_SORT: SortOptions = { mode: 'az', caseSensitive: false, blankLines: 'remove' };

const collators = new Map<boolean, Intl.Collator>();
function collator(caseSensitive: boolean): Intl.Collator {
  let c = collators.get(caseSensitive);
  if (!c) {
    // "Natural" order: item2 before item10.
    c = new Intl.Collator(undefined, { numeric: true, sensitivity: caseSensitive ? 'variant' : 'base', caseFirst: 'upper' });
    collators.set(caseSensitive, c);
  }
  return c;
}

/** First number in a line (handles -3, 1,234.5 and 1.5e3). Lines without a number return null. */
export function leadingNumber(line: string): number | null {
  const m = line.match(/[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.find((s) => /\d/.test(s));
  if (!m) return null;
  const n = Number(m.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cryptoRandom(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export function sortLines(text: string, o: SortOptions, random: () => number = cryptoRandom): LinesResult {
  const all = splitLines(text);
  const blanks = all.filter((l) => l.trim() === '');
  let lines = o.blankLines === 'keep' ? all.slice() : all.filter((l) => l.trim() !== '');
  const cmp = collator(o.caseSensitive).compare;

  switch (o.mode) {
    case 'az':
      lines.sort(cmp);
      break;
    case 'za':
      lines.sort((a, b) => cmp(b, a));
      break;
    case 'num-asc':
    case 'num-desc': {
      const dir = o.mode === 'num-asc' ? 1 : -1;
      const keyed = lines.map((l, i) => ({ l, i, n: leadingNumber(l) }));
      keyed.sort((a, b) => {
        // Lines without numbers go last, in their original order.
        if (a.n === null && b.n === null) return a.i - b.i;
        if (a.n === null) return 1;
        if (b.n === null) return -1;
        return (a.n - b.n) * dir || a.i - b.i;
      });
      lines = keyed.map((k) => k.l);
      break;
    }
    case 'short':
    case 'long': {
      const dir = o.mode === 'short' ? 1 : -1;
      lines = lines
        .map((l, i) => ({ l, i, n: [...l].length }))
        .sort((a, b) => (a.n - b.n) * dir || a.i - b.i)
        .map((k) => k.l);
      break;
    }
    case 'reverse':
      lines.reverse();
      break;
    case 'random':
      shuffle(lines, random);
      break;
  }
  if (o.blankLines === 'end') lines = lines.concat(blanks);
  return { text: lines.join('\n'), before: all.length, after: lines.length };
}
