/** Case conversion for the Case Converter. All Unicode-aware. */

export const CASES = [
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'lower', label: 'lowercase' },
  { id: 'sentence', label: 'Sentence case' },
  { id: 'title', label: 'Title Case' },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'dot', label: 'dot.case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
] as const;

export type CaseId = (typeof CASES)[number]['id'];

export function isCaseId(v: string): v is CaseId {
  return CASES.some((c) => c.id === v);
}

// Short words kept lowercase in Title Case unless first or last (common English style guides).
const MINOR = new Set(
  'a an and as at but by en for if in nor of on or per the to v vs via'.split(' '),
);

const upperFirst = (w: string) => {
  const cp = String.fromCodePoint(w.codePointAt(0)!);
  return cp.toLocaleUpperCase() + w.slice(cp.length);
};

/** Sentence case: lowercase everything, then capitalise the first letter of each sentence and the pronoun "I". */
export function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase();
  return lower
    .replace(/(^|[.!?…。！？]["'”’)\]]*\s+|\n\s*)(\p{Ll})/gu, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase())
    .replace(/(^|[^\p{L}\p{N}])i(?=$|[^\p{L}\p{N}]|['’](?:m|d|ll|ve)\b)/gu, '$1I');
}

/** Title Case with minor words kept lowercase, per line. Words already in ALL CAPS (acronyms) are kept. */
export function titleCase(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const tokens = line.split(/(\s+)/);
      const wordIdx = tokens.map((t, i) => (/\S/.test(t) ? i : -1)).filter((i) => i >= 0);
      const first = wordIdx[0];
      const last = wordIdx[wordIdx.length - 1];
      return tokens
        .map((t, i) => {
          if (!/\S/.test(t)) return t;
          const isAcronym = t.length > 1 && /^[\p{Lu}\p{N}&.]+$/u.test(t) && /\p{Lu}.*\p{Lu}/u.test(t);
          if (isAcronym) return t;
          const lower = t.toLocaleLowerCase();
          const bare = lower.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
          if (i !== first && i !== last && MINOR.has(bare)) return lower;
          // Capitalise after leading punctuation and each hyphen part: "well-known" → "Well-Known".
          return lower.replace(/(^|[-/(\["'“‘])(\p{Ll})/gu, (_m, p: string, c: string) => p + c.toLocaleUpperCase());
        })
        .join('');
    })
    .join('\n');
}

/** Split into words for programming cases: handles spaces, punctuation, camelCase and digit boundaries. */
export function splitWords(text: string): string[] {
  return (
    text
      .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
      .match(/[\p{L}\p{N}\p{M}]+/gu) ?? []
  );
}

/** Programming cases are applied per line so a list of names stays a list. */
function perLine(text: string, fn: (words: string[]) => string): string {
  return text
    .split('\n')
    .map((l) => fn(splitWords(l)))
    .join('\n');
}

export function convertCase(text: string, to: CaseId): string {
  switch (to) {
    case 'upper':
      return text.toLocaleUpperCase();
    case 'lower':
      return text.toLocaleLowerCase();
    case 'sentence':
      return sentenceCase(text);
    case 'title':
      return titleCase(text);
    case 'camel':
      return perLine(text, (w) => w.map((x, i) => (i === 0 ? x.toLocaleLowerCase() : upperFirst(x.toLocaleLowerCase()))).join(''));
    case 'pascal':
      return perLine(text, (w) => w.map((x) => upperFirst(x.toLocaleLowerCase())).join(''));
    case 'snake':
      return perLine(text, (w) => w.map((x) => x.toLocaleLowerCase()).join('_'));
    case 'kebab':
      return perLine(text, (w) => w.map((x) => x.toLocaleLowerCase()).join('-'));
    case 'dot':
      return perLine(text, (w) => w.map((x) => x.toLocaleLowerCase()).join('.'));
    case 'constant':
      return perLine(text, (w) => w.map((x) => x.toLocaleUpperCase()).join('_'));
  }
}
