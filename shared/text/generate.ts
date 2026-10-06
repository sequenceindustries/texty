/** Generators: URL slugs, Lorem Ipsum and repeated text. */

// ---------- Slug ----------

export interface SlugOptions {
  separator: '-' | '_';
  lowercase: boolean;
  /** Drop letters that have no Latin form (e.g. Cyrillic, Chinese) instead of keeping them. */
  asciiOnly: boolean;
  /** 0 = no limit. Cuts at a word boundary. */
  maxLength: number;
}

export const DEFAULT_SLUG: SlugOptions = { separator: '-', lowercase: true, asciiOnly: false, maxLength: 0 };

// Letters that Unicode decomposition does not reduce to ASCII.
const TRANSLIT: Record<string, string> = {
  ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ø: 'o', Ø: 'O', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D',
  ð: 'd', Ð: 'D', þ: 'th', Þ: 'TH', ı: 'i', ŀ: 'l', ħ: 'h', Ħ: 'H', ŧ: 't', Ŧ: 'T', '&': ' and ', '@': ' at ',
};

export function slugify(input: string, o: SlugOptions = DEFAULT_SLUG): string {
  let s = input.replace(/[ßẞæÆœŒøØłŁđĐðÐþÞıŀħĦŧŦ&@]/g, (c) => TRANSLIT[c] ?? c);
  // Strip accents: é → e, ñ → n.
  s = s.normalize('NFKD').replace(/\p{M}/gu, '');
  // Apostrophes join words: "don't" → "dont".
  s = s.replace(/['’]/g, '');
  if (o.lowercase) s = s.toLocaleLowerCase();
  const keep = o.asciiOnly ? /[^A-Za-z0-9]+/g : /[^\p{L}\p{N}]+/gu;
  s = s.replace(keep, ' ').trim();
  let parts = s.split(/\s+/).filter(Boolean);
  if (o.maxLength > 0) {
    const out: string[] = [];
    let len = 0;
    for (const p of parts) {
      const add = (out.length ? 1 : 0) + p.length;
      if (len + add > o.maxLength) {
        if (out.length === 0) out.push(p.slice(0, o.maxLength));
        break;
      }
      out.push(p);
      len += add;
    }
    parts = out;
  }
  return parts.join(o.separator);
}

/** One slug per non-empty input line. */
export function slugifyLines(input: string, o: SlugOptions = DEFAULT_SLUG): string {
  return input
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => slugify(l, o))
    .join('\n');
}

// ---------- Lorem ipsum ----------

const LOREM_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui ' +
  'officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar sapien ligula viverra mauris ' +
  'vitae ultricies leo integer malesuada nullam ac tortor quam pellentesque nec nam aliquam sem et risus fermentum morbi ' +
  'tristique senectus netus fames turpis egestas sagittis eu volutpat odio facilisis feugiat porta lectus arcu bibendum at ' +
  'varius vel pharetra blandit cursus euismod orci dapibus ultrices iaculis eget faucibus purus semper gravida dictum'
).split(' ');

export const LOREM_OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

export type LoremUnit = 'words' | 'sentences' | 'paragraphs';
export const LOREM_MAX: Record<LoremUnit, number> = { words: 10_000, sentences: 1_000, paragraphs: 200 };

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  startWithLorem: boolean;
  html: boolean;
}

function int(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function words(n: number, random: () => number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = LOREM_WORDS[Math.floor(random() * LOREM_WORDS.length)];
    if (w === out[out.length - 1]) w = LOREM_WORDS[(LOREM_WORDS.indexOf(w) + 7) % LOREM_WORDS.length];
    out.push(w);
  }
  return out;
}

function sentence(random: () => number): string {
  const w = words(int(random, 6, 14), random);
  // An occasional comma reads more naturally.
  if (w.length > 8 && random() < 0.5) w[int(random, 3, w.length - 4)] += ',';
  const s = w.join(' ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}

function paragraph(random: () => number): string {
  const n = int(random, 4, 7);
  return Array.from({ length: n }, () => sentence(random)).join(' ');
}

export function lorem(o: LoremOptions, random: () => number = Math.random): string {
  const count = Math.max(1, Math.min(LOREM_MAX[o.unit], Math.floor(o.count) || 1));
  let blocks: string[];
  if (o.unit === 'words') {
    const w = words(count, random);
    if (o.startWithLorem) {
      const open = LOREM_OPENING.replace(',', '').toLowerCase().split(' ');
      for (let i = 0; i < Math.min(open.length, w.length); i++) w[i] = open[i];
    }
    const s = w.join(' ');
    blocks = [s[0].toUpperCase() + s.slice(1)];
  } else if (o.unit === 'sentences') {
    const list = Array.from({ length: count }, () => sentence(random));
    if (o.startWithLorem) list[0] = LOREM_OPENING + '.';
    blocks = [list.join(' ')];
  } else {
    blocks = Array.from({ length: count }, () => paragraph(random));
    if (o.startWithLorem) blocks[0] = LOREM_OPENING + ', ' + blocks[0][0].toLowerCase() + blocks[0].slice(1);
  }
  if (o.html) return blocks.map((b) => `<p>${b}</p>`).join('\n');
  return blocks.join('\n\n');
}

// ---------- Repeat ----------

/** Output above this many characters needs an explicit confirmation. */
export const REPEAT_WARN_CHARS = 1_000_000;
/** Hard ceiling, to keep the browser responsive. */
export const REPEAT_MAX_CHARS = 10_000_000;
export const REPEAT_MAX_COUNT = 100_000;

export type SeparatorId = 'newline' | 'space' | 'comma' | 'none' | 'custom';

export function separatorFor(id: SeparatorId, custom = ''): string {
  switch (id) {
    case 'newline':
      return '\n';
    case 'space':
      return ' ';
    case 'comma':
      return ', ';
    case 'none':
      return '';
    case 'custom':
      // Let people type \n and \t.
      return custom.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
}

/** Exact output length in UTF-16 units, computed without building the string. */
export function repeatSize(text: string, count: number, sep: string): number {
  if (count <= 0 || !text) return 0;
  return text.length * count + sep.length * (count - 1);
}

export type RepeatCheck = { ok: true; size: number; warn: boolean } | { ok: false; reason: 'empty' | 'count' | 'too-large'; size: number };

export function checkRepeat(text: string, count: number, sep: string): RepeatCheck {
  const size = repeatSize(text, count, sep);
  if (!text) return { ok: false, reason: 'empty', size };
  if (!Number.isInteger(count) || count < 1 || count > REPEAT_MAX_COUNT) return { ok: false, reason: 'count', size };
  if (size > REPEAT_MAX_CHARS) return { ok: false, reason: 'too-large', size };
  return { ok: true, size, warn: size > REPEAT_WARN_CHARS };
}

export function repeatText(text: string, count: number, sep: string): string {
  const c = checkRepeat(text, count, sep);
  if (!c.ok) return '';
  // Array join builds the string once rather than by repeated concatenation.
  return new Array(count).fill(text).join(sep);
}
