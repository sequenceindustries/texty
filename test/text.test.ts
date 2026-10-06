import { describe, expect, it } from 'vitest';
import { charStats, countCharacters, countSentences, countWords, formatMinutes, smsInfo, wordFrequency, wordStats } from '../shared/text/stats';
import { convertCase, splitWords, titleCase, sentenceCase } from '../shared/text/case';
import { cleanText, DEFAULT_CLEAN } from '../shared/text/clean';
import { DEFAULT_DEDUPE, removeDuplicateLines, sortLines, leadingNumber } from '../shared/text/lines';
import { buildPattern, countMatches, replaceText } from '../shared/text/find';
import { diffTexts, diffToText, myers } from '../shared/text/diff';
import { checkRepeat, lorem, repeatSize, repeatText, separatorFor, slugify, slugifyLines, DEFAULT_SLUG, REPEAT_MAX_CHARS } from '../shared/text/generate';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('stats', () => {
  it('handles empty input', () => {
    expect(wordStats('')).toEqual({
      words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, lines: 0, readingTime: '0 min', speakingTime: '0 min',
    });
  });
  it('counts a single word', () => {
    const s = wordStats('hello');
    expect(s).toMatchObject({ words: 1, characters: 5, sentences: 1, paragraphs: 1, lines: 1 });
  });
  it('counts words with contractions, hyphens, emails and numbers as one word each', () => {
    expect(countWords("don't well-known 3.14 me@x.com it’s")).toBe(5);
  });
  it('ignores punctuation and runs of spaces', () => {
    expect(countWords('  one,   two ... three!!  ')).toBe(3);
  });
  it('counts CJK characters as words and accented words as one', () => {
    expect(countWords('我爱你')).toBe(3);
    expect(countWords('café naïve résumé')).toBe(3);
  });
  it('counts emoji and combining characters as single characters', () => {
    expect(countCharacters('👍🏽')).toBe(1);
    expect(countCharacters('é')).toBe(1);
    expect(countCharacters('👨‍👩‍👧')).toBe(1);
  });
  it('counts sentences, paragraphs and lines', () => {
    const t = 'Hello there. How are you? Fine!\n\nNew paragraph... ends here.\nLast line';
    const s = wordStats(t);
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(4);
    expect(countSentences(t)).toBe(6);
    expect(countSentences('Version 2.5 is out. Great.')).toBe(2);
  });
  it('does not treat HTML-like text specially', () => {
    expect(countWords('<p>Hello <b>world</b></p>')).toBe(6);
  });
  it('formats reading time', () => {
    expect(formatMinutes(0, 238)).toBe('0 min');
    expect(formatMinutes(100, 238)).toBe('25 sec');
    expect(formatMinutes(238 * 4, 238)).toBe('4 min');
    expect(formatMinutes(238 * 75, 238)).toBe('1 h 15 min');
  });
  it('is fast on large text', () => {
    const big = 'The quick brown fox jumps over the lazy dog. '.repeat(50_000); // ~2.2M chars
    const t = performance.now();
    const s = wordStats(big);
    expect(s.words).toBe(450_000);
    expect(performance.now() - t).toBeLessThan(1500);
  });
  it('ranks word frequency case-insensitively and can skip common words', () => {
    const f = wordFrequency('The cat and the Cat and THE dog', { limit: 3 });
    expect(f[0]).toMatchObject({ word: 'the', count: 3 });
    expect(f[1]).toMatchObject({ word: 'and', count: 2 });
    const g = wordFrequency('The cat and the Cat', { skipCommon: true });
    expect(g.map((r) => r.word)).toEqual(['cat']);
  });
  it('breaks down character classes', () => {
    expect(charStats('Ab 12, €!\nx')).toMatchObject({ letters: 3, numbers: 2, punctuation: 2, symbols: 1, spaces: 3, lines: 2 });
  });
  it('computes SMS segments per GSM 03.38', () => {
    expect(smsInfo('a'.repeat(160))).toMatchObject({ encoding: 'GSM-7', segments: 1 });
    expect(smsInfo('a'.repeat(161))).toMatchObject({ segments: 2, perSegment: 153 });
    expect(smsInfo('€'.repeat(80))).toMatchObject({ encoding: 'GSM-7', units: 160, segments: 1 });
    expect(smsInfo('hi 😀')).toMatchObject({ encoding: 'Unicode', segments: 1, perSegment: 70 });
    expect(smsInfo('ж'.repeat(71))).toMatchObject({ encoding: 'Unicode', segments: 2 });
  });
});

describe('case', () => {
  const text = 'hello World from Texty';
  it.each([
    ['upper', 'HELLO WORLD FROM TEXTY'],
    ['lower', 'hello world from texty'],
    ['camel', 'helloWorldFromTexty'],
    ['pascal', 'HelloWorldFromTexty'],
    ['snake', 'hello_world_from_texty'],
    ['kebab', 'hello-world-from-texty'],
    ['dot', 'hello.world.from.texty'],
    ['constant', 'HELLO_WORLD_FROM_TEXTY'],
  ] as const)('%s', (id, out) => expect(convertCase(text, id)).toBe(out));

  it('title case keeps minor words lowercase except first and last', () => {
    expect(titleCase('the lord of the rings')).toBe('The Lord of the Rings');
    expect(titleCase('what are you looking at')).toBe('What Are You Looking At');
    expect(titleCase('a well-known NASA story')).toBe('A Well-Known NASA Story');
  });
  it('sentence case capitalises sentence starts and the pronoun I', () => {
    expect(sentenceCase('HELLO THERE. i think i\'m FINE! ok?\nnew line')).toBe("Hello there. I think I'm fine! Ok?\nNew line");
  });
  it('splits identifiers and keeps lines separate', () => {
    expect(splitWords('XMLHttpRequest userID2Fa')).toEqual(['XML', 'Http', 'Request', 'user', 'ID2', 'Fa']);
    expect(convertCase('first name\nlast name', 'snake')).toBe('first_name\nlast_name');
  });
  it('handles accents and empty input', () => {
    expect(convertCase('crème brûlée', 'pascal')).toBe('CrèmeBrûlée');
    expect(convertCase('', 'title')).toBe('');
  });
});

describe('clean', () => {
  it('cleans with defaults and reports what changed', () => {
    const r = cleanText('  Hello   world  \r\n\r\n\r\n​Next line \t\n\n', DEFAULT_CLEAN);
    expect(r.text).toBe('Hello world\n\nNext line');
    expect(r.report.invisible).toBe(2);
    expect(r.report.lineBreaks).toBe(3);
    expect(r.changed).toBe(true);
  });
  it('does nothing when every option is off', () => {
    const t = '  a  \n\n\n b​ ';
    const r = cleanText(t, { normalizeLineBreaks: false, removeInvisible: false, collapseSpaces: false, trimLines: false, blankLines: 'keep', trimText: false, straightenQuotes: false });
    expect(r.text).toBe(t);
    expect(r.changed).toBe(false);
  });
  it('removes every blank line on request and keeps indentation if trimming is off', () => {
    const r = cleanText('a\n\n  b  c\n   \nd', { ...DEFAULT_CLEAN, trimLines: false, blankLines: 'remove' });
    expect(r.text).toBe('a\n  b c\nd');
  });
  it('straightens quotes only when asked', () => {
    expect(cleanText('“Hi” it’s', DEFAULT_CLEAN).text).toBe('“Hi” it’s');
    expect(cleanText('“Hi” it’s', { ...DEFAULT_CLEAN, straightenQuotes: true }).text).toBe('"Hi" it\'s');
  });
  it('keeps emoji and other scripts intact', () => {
    expect(cleanText('Привет  👋🏽   世界', DEFAULT_CLEAN).text).toBe('Привет 👋🏽 世界');
  });
});

describe('duplicate lines', () => {
  const list = 'Apple\nOrange\nApple\nBanana\nOrange';
  it('keeps the first occurrence in order', () => {
    expect(removeDuplicateLines(list, DEFAULT_DEDUPE)).toEqual({ text: 'Apple\nOrange\nBanana', before: 5, after: 3 });
  });
  it('keeps the last occurrence', () => {
    expect(removeDuplicateLines(list, { ...DEFAULT_DEDUPE, keep: 'last' }).text).toBe('Apple\nBanana\nOrange');
  });
  it('respects case sensitivity and whitespace', () => {
    expect(removeDuplicateLines('a\nA\n a ', DEFAULT_DEDUPE).text).toBe('a\nA');
    expect(removeDuplicateLines('a\nA\n a ', { ...DEFAULT_DEDUPE, caseSensitive: false }).text).toBe('a');
    expect(removeDuplicateLines('a\n a ', { ...DEFAULT_DEDUPE, ignoreWhitespace: false }).text).toBe('a\n a ');
  });
  it('can sort the result and drop blank lines', () => {
    expect(removeDuplicateLines('b\n\na\n\nb', { ...DEFAULT_DEDUPE, preserveOrder: false, removeBlank: true }).text).toBe('a\nb');
  });
  it('handles empty input and CRLF', () => {
    expect(removeDuplicateLines('', DEFAULT_DEDUPE)).toEqual({ text: '', before: 0, after: 0 });
    expect(removeDuplicateLines('x\r\nx\r\ny', DEFAULT_DEDUPE).text).toBe('x\ny');
  });
  it('is fast with 200k lines', () => {
    const big = Array.from({ length: 200_000 }, (_, i) => 'line ' + (i % 1000)).join('\n');
    const t = performance.now();
    expect(removeDuplicateLines(big, DEFAULT_DEDUPE).after).toBe(1000);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe('sort lines', () => {
  const o = { mode: 'az' as const, caseSensitive: false, blankLines: 'remove' as const };
  it('sorts naturally A→Z and Z→A', () => {
    expect(sortLines('item10\nitem2\nItem1\n\nbanana', o).text).toBe('banana\nItem1\nitem2\nitem10');
    expect(sortLines('a\nc\nb', { ...o, mode: 'za' }).text).toBe('c\nb\na');
  });
  it('sorts numerically with non-numbers last', () => {
    expect(sortLines('10 apples\n-3\nnone\n2.5\n1,000', { ...o, mode: 'num-asc' }).text).toBe('-3\n2.5\n10 apples\n1,000\nnone');
    expect(sortLines('1\n3\n2', { ...o, mode: 'num-desc' }).text).toBe('3\n2\n1');
    expect(leadingNumber('abc')).toBeNull();
  });
  it('sorts by length, reverses and shuffles', () => {
    expect(sortLines('ccc\na\nbb', { ...o, mode: 'short' }).text).toBe('a\nbb\nccc');
    expect(sortLines('ccc\na\nbb', { ...o, mode: 'long' }).text).toBe('ccc\nbb\na');
    expect(sortLines('1\n2\n3', { ...o, mode: 'reverse' }).text).toBe('3\n2\n1');
    const s = sortLines('1\n2\n3\n4\n5', { ...o, mode: 'random' }, seeded(7)).text;
    expect(s.split('\n').sort()).toEqual(['1', '2', '3', '4', '5']);
  });
  it('handles blank lines per option', () => {
    expect(sortLines('b\n\na', { ...o, blankLines: 'end' }).text).toBe('a\nb\n');
    expect(sortLines('b\n\na', { ...o, blankLines: 'keep' }).text).toBe('\na\nb');
  });
});

describe('find and replace', () => {
  const base = { find: '', replace: '', caseSensitive: false, wholeWord: false, regex: false };
  it('replaces plain text literally, first or all', () => {
    const o = { ...base, find: 'a.b', replace: '$1$&' };
    expect(replaceText('a.b axb a.b', o, 'all')).toEqual({ text: '$1$& axb $1$&', replaced: 2 });
    expect(replaceText('a.b a.b', o, 'first')).toEqual({ text: '$1$& a.b', replaced: 1 });
  });
  it('respects case and whole word, including accented letters', () => {
    expect(replaceText('Cat cat concat', { ...base, find: 'cat', replace: 'dog', caseSensitive: true }, 'all')).toMatchObject({ text: 'Cat dog condog' });
    expect(replaceText('Cat cat concat', { ...base, find: 'cat', replace: 'dog', wholeWord: true }, 'all')).toMatchObject({ text: 'dog dog concat' });
    expect(replaceText('café cafés', { ...base, find: 'café', replace: 'X', wholeWord: true }, 'all')).toMatchObject({ text: 'X cafés' });
  });
  it('supports regex with groups, named groups and \\n', () => {
    const o = { ...base, regex: true, find: '(\\w+)@(?<host>\\w+)', replace: '$2:$1 $<host>\\n' };
    expect(replaceText('bob@ex', o, 'all')).toMatchObject({ text: 'ex:bob ex\n' });
  });
  it('validates bad regex with a friendly message', () => {
    const p = buildPattern({ find: '(abc', caseSensitive: false, wholeWord: false, regex: true });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toMatch(/bracket/);
    expect(replaceText('x', { ...base, regex: true, find: '[' }, 'all')).toHaveProperty('error');
  });
  it('counts zero-length matches without looping forever', () => {
    const p = buildPattern({ find: '^', caseSensitive: false, wholeWord: false, regex: true });
    if (!p.ok) throw new Error();
    expect(countMatches('a\nb', p.re)).toBe(1);
    const q = buildPattern({ find: 'x*', caseSensitive: false, wholeWord: false, regex: true });
    if (!q.ok) throw new Error();
    expect(countMatches('ab', q.re)).toBe(3);
  });
  it('treats special characters in plain search literally', () => {
    expect(replaceText('price $5 (approx)', { ...base, find: '$5 (approx)', replace: '£4' }, 'all')).toMatchObject({ text: 'price £4' });
    expect(replaceText('a-b', { ...base, find: '-', replace: '+', wholeWord: true }, 'all')).toMatchObject({ replaced: 1 });
  });
});

describe('diff', () => {
  const o = { ignoreWhitespace: false, ignoreCase: false };
  it('reports identical texts', () => {
    const r = diffTexts('a\nb', 'a\nb\n', o);
    expect(r.identical).toBe(true);
    expect(r.stats.matching).toBe(2);
  });
  it('finds added, removed and changed lines', () => {
    const r = diffTexts('one\ntwo\nthree\nfour', 'one\n2\nthree\nfour\nfive', o);
    expect(r.stats).toEqual({ added: 1, removed: 0, changed: 1, matching: 3 });
    const changed = r.rows.find((x) => x.type === 'changed');
    expect(changed).toMatchObject({ aNo: 2, bNo: 2 });
    const r2 = diffTexts('a\nb\nc', 'a\nc', o);
    expect(r2.stats).toEqual({ added: 0, removed: 1, changed: 0, matching: 2 });
  });
  it('highlights changed words inside a line', () => {
    const r = diffTexts('The quick brown fox', 'The slow brown fox', o);
    const row = r.rows[0];
    expect(row.type).toBe('changed');
    if (row.type === 'changed') {
      expect(row.a.filter((s) => s.changed).map((s) => s.text)).toEqual(['quick']);
      expect(row.b.filter((s) => s.changed).map((s) => s.text)).toEqual(['slow']);
    }
  });
  it('can ignore whitespace and case', () => {
    expect(diffTexts('Hello  World', 'hello world', { ignoreWhitespace: true, ignoreCase: true }).identical).toBe(true);
  });
  it('handles empty sides', () => {
    expect(diffTexts('', 'a\nb', o).stats.added).toBe(2);
    expect(diffTexts('a', '', o).stats.removed).toBe(1);
    expect(diffTexts('', '', o).identical).toBe(true);
  });
  it('produces a minimal edit script', () => {
    const a = Int32Array.from([1, 2, 3, 1, 2, 2, 1]);
    const b = Int32Array.from([3, 2, 1, 2, 1, 3]);
    const ops = myers(a, b, 100)!;
    expect(ops.filter((x) => x.t !== 0).length).toBe(5);
  });
  it('falls back gracefully when texts are totally different and large', () => {
    const a = Array.from({ length: 5000 }, (_, i) => 'a' + i).join('\n');
    const b = Array.from({ length: 5000 }, (_, i) => 'b' + i).join('\n');
    const t = performance.now();
    const r = diffTexts(a, b, o);
    expect(r.approximate).toBe(true);
    expect(r.stats).toMatchObject({ removed: 5000, added: 5000 });
    expect(performance.now() - t).toBeLessThan(5000);
  });
  it('renders a copyable unified text', () => {
    expect(diffToText(diffTexts('a\nb', 'a\nc', o))).toBe('  a\n- b\n+ c');
  });
});

describe('slug', () => {
  it('matches the brief example', () => {
    expect(slugify('How To Start A Small Business In 2026!')).toBe('how-to-start-a-small-business-in-2026');
  });
  it('strips accents, transliterates and handles symbols', () => {
    expect(slugify('Crème Brûlée & Straße — Ærø!')).toBe('creme-brulee-and-strasse-aero');
    expect(slugify("Don't   stop")).toBe('dont-stop');
  });
  it('keeps non-Latin scripts unless ASCII-only', () => {
    expect(slugify('Привет мир')).toBe('привет-мир');
    expect(slugify('Привет мир 2', { ...DEFAULT_SLUG, asciiOnly: true })).toBe('2');
    expect(slugify('東京 travel guide')).toBe('東京-travel-guide');
  });
  it('supports underscore, max length and per-line input', () => {
    expect(slugify('hello big world', { ...DEFAULT_SLUG, separator: '_' })).toBe('hello_big_world');
    expect(slugify('hello big world', { ...DEFAULT_SLUG, maxLength: 9 })).toBe('hello-big');
    expect(slugifyLines('A b\n\nC d')).toBe('a-b\nc-d');
    expect(slugify('!!!')).toBe('');
    expect(slugify('emoji 🎉 party')).toBe('emoji-party');
  });
});

describe('lorem', () => {
  it('generates the requested amount', () => {
    const r = seeded(3);
    expect(lorem({ unit: 'words', count: 12, startWithLorem: true, html: false }, r).split(' ')).toHaveLength(12);
    expect(lorem({ unit: 'paragraphs', count: 3, startWithLorem: true, html: false }, r).split('\n\n')).toHaveLength(3);
    expect(lorem({ unit: 'sentences', count: 4, startWithLorem: false, html: false }, r).match(/\./g)).toHaveLength(4);
  });
  it('starts with Lorem ipsum and wraps HTML on request', () => {
    const p = lorem({ unit: 'paragraphs', count: 2, startWithLorem: true, html: true }, seeded(5));
    expect(p.startsWith('<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, ')).toBe(true);
    expect(p.split('\n')).toHaveLength(2);
    expect(lorem({ unit: 'words', count: 2, startWithLorem: true, html: false })).toBe('Lorem ipsum');
  });
  it('clamps silly quantities', () => {
    expect(lorem({ unit: 'paragraphs', count: 1e9, startWithLorem: false, html: false }, seeded(1)).split('\n\n')).toHaveLength(200);
    expect(lorem({ unit: 'words', count: -5, startWithLorem: false, html: false }, seeded(1)).split(' ')).toHaveLength(1);
  });
});

describe('repeat', () => {
  it('repeats with separators', () => {
    expect(repeatText('Hello', 3, separatorFor('newline'))).toBe('Hello\nHello\nHello');
    expect(repeatText('a', 3, separatorFor('comma'))).toBe('a, a, a');
    expect(repeatText('a', 3, separatorFor('custom', ' | \\n'))).toBe('a | \na | \na');
  });
  it('predicts size and refuses huge output', () => {
    expect(repeatSize('abc', 4, ', ')).toBe(18);
    expect(checkRepeat('x'.repeat(1000), 100_000, '\n')).toMatchObject({ ok: false, reason: 'too-large' });
    expect(checkRepeat('x', 0, '')).toMatchObject({ ok: false, reason: 'count' });
    expect(checkRepeat('', 5, '')).toMatchObject({ ok: false, reason: 'empty' });
    expect(checkRepeat('x'.repeat(20), 60_000, '\n')).toMatchObject({ ok: true, warn: true });
    expect(repeatText('x'.repeat(1000), 100_000, '\n')).toBe('');
    expect(REPEAT_MAX_CHARS).toBe(10_000_000);
  });
});
