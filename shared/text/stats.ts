/**
 * Text statistics for the Word Counter and Character Counter.
 * Pure functions, no DOM: they run in the browser and in tests.
 */

/** Words per minute used for reading / speaking estimates. */
export const READING_WPM = 238;
export const SPEAKING_WPM = 150;

/** Above this length, grapheme segmentation is skipped for speed (code points are counted instead). */
export const GRAPHEME_LIMIT = 300_000;

// Scripts written without spaces between words: each character counts as a word.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const WORD_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]|[\p{L}\p{N}\p{M}]+(?:['’\-_.@][\p{L}\p{N}\p{M}]+)*/gu;

let graphemer: Intl.Segmenter | null | undefined;
function segmenter(): Intl.Segmenter | null {
  if (graphemer === undefined) {
    graphemer = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  return graphemer;
}

/** User-perceived characters (an emoji or "é" counts once). */
export function countCharacters(text: string): number {
  if (!text) return 0;
  // Fast path: plain ASCII is one char per code unit.
  // eslint-disable-next-line no-control-regex
  if (text.length < 2_000_000 && /^[\x00-\x7f]*$/.test(text)) return text.length;
  const seg = segmenter();
  if (seg && text.length <= GRAPHEME_LIMIT) {
    let n = 0;
    for (const _ of seg.segment(text)) n++;
    return n;
  }
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) i++; // surrogate pair = one code point
    n++;
  }
  return n;
}

export function countWords(text: string): number {
  if (!text) return 0;
  let n = 0;
  WORD_RE.lastIndex = 0;
  while (WORD_RE.exec(text)) n++;
  return n;
}

export function countLines(text: string): number {
  if (!text) return 0;
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

export function countParagraphs(text: string): number {
  if (!text.trim()) return 0;
  return text.split(/\n[ \t ]*\n/).filter((p) => /\S/.test(p)).length;
}

export function countSentences(text: string): number {
  if (!text.trim()) return 0;
  // A sentence ends with terminal punctuation followed by whitespace, a closing quote/bracket, or the end.
  const parts = text.split(/(?<=[.!?…。！？]+["'”’)\]]*)(?:\s+|$)|\n[ \t]*\n/u);
  let n = 0;
  for (const p of parts) if (/[\p{L}\p{N}]/u.test(p)) n++;
  return n;
}

/** Minutes as a short human label: "< 1 min", "4 min", "1 h 12 min". */
export function formatMinutes(words: number, wpm: number): string {
  if (words === 0) return '0 min';
  const mins = words / wpm;
  if (mins < 1) {
    const s = Math.max(1, Math.round(mins * 60));
    return `${s} sec`;
  }
  const total = Math.round(mins);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${total % 60} min`;
}

export interface WordStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTime: string;
  speakingTime: string;
}

export function wordStats(text: string): WordStats {
  const characters = countCharacters(text);
  const spaces = (text.match(/\s/g) ?? []).length;
  const words = countWords(text);
  return {
    words,
    characters,
    charactersNoSpaces: Math.max(0, characters - spaces),
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    readingTime: formatMinutes(words, READING_WPM),
    speakingTime: formatMinutes(words, SPEAKING_WPM),
  };
}

export interface CharStats {
  characters: number;
  charactersNoSpaces: number;
  spaces: number;
  letters: number;
  numbers: number;
  punctuation: number;
  symbols: number;
  lines: number;
}

export function charStats(text: string): CharStats {
  const characters = countCharacters(text);
  const spaces = (text.match(/\s/g) ?? []).length;
  return {
    characters,
    charactersNoSpaces: Math.max(0, characters - spaces),
    spaces,
    letters: (text.match(/\p{L}/gu) ?? []).length,
    numbers: (text.match(/\p{N}/gu) ?? []).length,
    punctuation: (text.match(/\p{P}/gu) ?? []).length,
    symbols: (text.match(/\p{S}/gu) ?? []).length,
    lines: countLines(text),
  };
}

// A short list of very common English words, hidden from the frequency table on request.
export const STOP_WORDS = new Set(
  (
    'a an and are as at be but by for from had has have he her his i if in into is it its me my of on or our she so ' +
    'that the their them there they this to was we were what when which who will with you your not do does did can ' +
    'just than then too very also been being about would could should all any some no yes up out'
  ).split(' '),
);

export interface FrequencyRow {
  word: string;
  count: number;
  share: number;
}

/** Most frequent words, case-insensitive. `share` is a fraction of all words. */
export function wordFrequency(text: string, opts: { limit?: number; skipCommon?: boolean } = {}): FrequencyRow[] {
  const { limit = 20, skipCommon = false } = opts;
  const counts = new Map<string, number>();
  let total = 0;
  WORD_RE.lastIndex = 0;
  for (let m = WORD_RE.exec(text); m; m = WORD_RE.exec(text)) {
    total++;
    const w = m[0].toLocaleLowerCase().replace(/’/g, "'");
    if (skipCommon && STOP_WORDS.has(w)) continue;
    if (/^\p{N}+$/u.test(w) && !CJK.test(w)) continue; // bare numbers are noise
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  return rows.map(([word, count]) => ({ word, count, share: total ? count / total : 0 }));
}

// ---------- Character limits ----------

// GSM 03.38 basic and extension sets. Extension characters cost two septets.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
const GSM_BASIC_SET = new Set(GSM_BASIC);
const GSM_EXT_SET = new Set(GSM_EXT);

export interface SmsInfo {
  encoding: 'GSM-7' | 'Unicode';
  /** Length in the units the network counts (septets for GSM-7, UTF-16 units for Unicode). */
  units: number;
  segments: number;
  perSegment: number;
  /** Units left in the current segment. */
  remaining: number;
}

/** SMS length per GSM 03.38 / 3GPP TS 23.040: 160 GSM-7 or 70 UCS-2 in one message, 153 / 67 per part when split. */
export function smsInfo(text: string): SmsInfo {
  let gsm = true;
  let septets = 0;
  for (const ch of text) {
    if (GSM_BASIC_SET.has(ch)) septets += 1;
    else if (GSM_EXT_SET.has(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    const per = segments > 1 ? 153 : 160;
    return { encoding: 'GSM-7', units: septets, segments, perSegment: per, remaining: segments === 0 ? 160 : segments * per - septets };
  }
  const units = text.length; // UTF-16 code units
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  const per = segments > 1 ? 67 : 70;
  return { encoding: 'Unicode', units, segments, perSegment: per, remaining: segments * per - units };
}
