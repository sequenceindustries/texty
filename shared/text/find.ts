/** Find & Replace. Patterns are validated here; the browser runs matching in a worker with a time limit. */

export interface FindOptions {
  find: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export type PatternResult = { ok: true; re: RegExp } | { ok: false; error: string };

export const MAX_PATTERN_LENGTH = 1000;

export function escapeRegExp(s: string): string {
  // "-" is only special inside [...], which this never produces, and escaping it is invalid in Unicode mode.
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPattern(o: Pick<FindOptions, 'find' | 'caseSensitive' | 'wholeWord' | 'regex'>): PatternResult {
  if (!o.find) return { ok: false, error: 'empty' };
  if (o.find.length > MAX_PATTERN_LENGTH) return { ok: false, error: 'Search text is too long (1,000 characters max).' };
  const source = o.regex ? o.find : escapeRegExp(o.find);
  const flags = 'g' + (o.caseSensitive ? '' : 'i');
  // Prefer Unicode mode (so \p{L} works and whole-word respects accents); fall back for patterns it rejects.
  // Whole word: a boundary is only required on a side where the search itself starts/ends with a word character
  // (so searching "-" or "$5" with whole word still works). Regex patterns get boundaries on both sides.
  const wordStart = o.regex || /^[\p{L}\p{N}_]/u.test(o.find);
  const wordEnd = o.regex || /[\p{L}\p{N}_]$/u.test(o.find);
  const attempts: [string, string][] = o.wholeWord
    ? [
        [`${wordStart ? '(?<![\\p{L}\\p{N}\\p{M}_])' : ''}(?:${source})${wordEnd ? '(?![\\p{L}\\p{N}\\p{M}_])' : ''}`, flags + 'u'],
        [`${wordStart ? '\\b' : ''}(?:${source})${wordEnd ? '\\b' : ''}`, flags],
      ]
    : [
        [source, flags + 'u'],
        [source, flags],
      ];
  let lastError = '';
  for (const [src, f] of attempts) {
    try {
      return { ok: true, re: new RegExp(src, f) };
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  return { ok: false, error: friendlyRegexError(lastError) };
}

function friendlyRegexError(msg: string): string {
  if (/unterminated group|missing \)/i.test(msg)) return 'A bracket ( is not closed.';
  if (/unmatched '\)'|unmatched \)/i.test(msg)) return 'There is a ) without a matching (.';
  if (/character class|missing \]/i.test(msg)) return 'A [ is not closed.';
  if (/nothing to repeat/i.test(msg)) return '*, + or ? needs something before it to repeat.';
  if (/invalid escape|\\ at end/i.test(msg)) return 'The pattern ends with a lone backslash or uses an invalid escape.';
  if (/quantifier|numbers out of order/i.test(msg)) return 'A {n,m} repeat count is invalid.';
  return 'Please check your regular expression and try again.';
}

export const MAX_COUNTED_MATCHES = 1_000_000;

/** Number of matches (zero-length matches included, as the replacement would see them). */
export function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    n++;
    if (m[0] === '') re.lastIndex++;
    if (n >= MAX_COUNTED_MATCHES) break;
  }
  re.lastIndex = 0;
  return n;
}

export interface ReplaceResult {
  text: string;
  replaced: number;
}

/**
 * Plain mode inserts the replacement literally. Regex mode supports $1, $<name>, $& and \n / \t.
 */
export function replaceText(text: string, o: FindOptions, mode: 'first' | 'all'): ReplaceResult | { error: string } {
  const p = buildPattern(o);
  if (!p.ok) return { error: p.error };
  const re = mode === 'all' ? p.re : new RegExp(p.re.source, p.re.flags.replace('g', ''));
  let replaced = 0;
  let out: string;
  if (o.regex) {
    const repl = o.replace.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    out = text.replace(re, (...args) => {
      replaced++;
      // Expand $-references the same way String.prototype.replace would.
      const groups = typeof args[args.length - 1] === 'object' ? (args[args.length - 1] as Record<string, string>) : undefined;
      const numEnd = groups ? args.length - 3 : args.length - 2;
      const match = args[0] as string;
      const caps = args.slice(1, numEnd) as (string | undefined)[];
      return repl.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (tok, what: string, name?: string) => {
        if (what === '$') return '$';
        if (what === '&') return match;
        if (name !== undefined) return groups?.[name] ?? '';
        const i = Number(what);
        if (i >= 1 && i <= caps.length) return caps[i - 1] ?? '';
        return tok;
      });
    });
  } else {
    out = text.replace(re, () => {
      replaced++;
      return o.replace;
    });
  }
  return { text: out, replaced };
}
