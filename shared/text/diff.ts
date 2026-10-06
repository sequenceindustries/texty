/**
 * Text Diff: line-level Myers diff (O((N+M)·D) time, O(D²) memory), with
 * adjacent removed/added lines paired as "changed" and a word-level diff inside them.
 */

export const DIFF_MAX_LINES = 50_000;
export const DIFF_MAX_EDITS = 3_000;
const INLINE_MAX_TOKENS = 4_000;
const INLINE_MAX_EDITS = 600;

const EQ = 0;
const DEL = 1;
const INS = 2;
type Op = { t: 0 | 1 | 2; a: number; b: number };

/** Myers shortest edit script over integer arrays. Returns null if more than maxD edits are needed. */
export function myers(a: ArrayLike<number>, b: ArrayLike<number>, maxD: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  const limit = Math.min(max, maxD);
  for (let d = 0; d <= limit; d++) {
    // Keep only the band [-d-1, d+1] that backtracking can read.
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) return backtrack(trace, d, n, m);
    }
  }
  return null;
}

function backtrack(trace: Int32Array[], dEnd: number, n: number, m: number): Op[] {
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = dEnd; d > 0; d--) {
    const band = trace[d];
    const get = (k: number) => band[k + d + 1];
    const k = x - y;
    const prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
    const prevX = get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ t: EQ, a: x, b: y });
    }
    if (x === prevX) {
      y--;
      ops.push({ t: INS, a: x, b: y });
    } else {
      x--;
      ops.push({ t: DEL, a: x, b: y });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ t: EQ, a: x, b: y });
  }
  return ops.reverse();
}

export interface Segment {
  text: string;
  /** true when this part differs from the other side. */
  changed: boolean;
}

export type DiffRow =
  | { type: 'equal'; aNo: number; bNo: number; text: string }
  | { type: 'removed'; aNo: number; text: string }
  | { type: 'added'; bNo: number; text: string }
  | { type: 'changed'; aNo: number; bNo: number; a: Segment[]; b: Segment[] };

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
  matching: number;
}

export interface DiffResult {
  rows: DiffRow[];
  stats: DiffStats;
  /** The texts were too different for a minimal diff; the changed middle is shown as removed then added. */
  approximate: boolean;
  identical: boolean;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

export function splitForDiff(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r\n|\r|\n/);
  // A trailing newline does not create an extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function intern(aLines: string[], bLines: string[], norm: (s: string) => string): [Int32Array, Int32Array] {
  const ids = new Map<string, number>();
  const map = (arr: string[]) => {
    const out = new Int32Array(arr.length);
    arr.forEach((l, i) => {
      const k = norm(l);
      let id = ids.get(k);
      if (id === undefined) ids.set(k, (id = ids.size));
      out[i] = id;
    });
    return out;
  };
  return [map(aLines), map(bLines)];
}

function tokens(s: string): string[] {
  return s.match(/\s+|[\p{L}\p{N}\p{M}_]+|[^\s\p{L}\p{N}\p{M}_]/gu) ?? [];
}

/** Word-level diff for one changed line pair. */
export function inlineDiff(a: string, b: string, opts: DiffOptions): { a: Segment[]; b: Segment[] } {
  const ta = tokens(a);
  const tb = tokens(b);
  const whole = { a: [{ text: a, changed: true }], b: [{ text: b, changed: true }] };
  if (ta.length > INLINE_MAX_TOKENS || tb.length > INLINE_MAX_TOKENS) return whole;
  const norm = (s: string) => {
    let k = opts.ignoreWhitespace && /^\s+$/.test(s) ? ' ' : s;
    if (opts.ignoreCase) k = k.toLocaleLowerCase();
    return k;
  };
  const [ia, ib] = intern(ta, tb, norm);
  const ops = myers(ia, ib, INLINE_MAX_EDITS);
  if (!ops) return whole;
  const outA: Segment[] = [];
  const outB: Segment[] = [];
  const push = (arr: Segment[], text: string, changed: boolean) => {
    const last = arr[arr.length - 1];
    if (last && last.changed === changed) last.text += text;
    else arr.push({ text, changed });
  };
  for (const op of ops) {
    if (op.t === EQ) {
      push(outA, ta[op.a], false);
      push(outB, tb[op.b], false);
    } else if (op.t === DEL) push(outA, ta[op.a], true);
    else push(outB, tb[op.b], true);
  }
  // A lone changed space between two changed words reads better as part of the change.
  for (const arr of [outA, outB]) {
    for (let i = 1; i < arr.length - 1; i++) {
      if (!arr[i].changed && /^\s+$/.test(arr[i].text) && arr[i - 1].changed && arr[i + 1].changed) {
        arr[i - 1].text += arr[i].text + arr[i + 1].text;
        arr.splice(i, 2);
        i--;
      }
    }
  }
  return { a: outA, b: outB };
}

export function diffTexts(aText: string, bText: string, opts: DiffOptions): DiffResult {
  const aLines = splitForDiff(aText);
  const bLines = splitForDiff(bText);
  const norm = (s: string) => {
    let k = opts.ignoreWhitespace ? s.replace(/\s+/g, ' ').trim() : s;
    if (opts.ignoreCase) k = k.toLocaleLowerCase();
    return k;
  };
  const [ia, ib] = intern(aLines, bLines, norm);

  // Strip the common prefix and suffix before the expensive part.
  let pre = 0;
  while (pre < ia.length && pre < ib.length && ia[pre] === ib[pre]) pre++;
  let suf = 0;
  while (suf < ia.length - pre && suf < ib.length - pre && ia[ia.length - 1 - suf] === ib[ib.length - 1 - suf]) suf++;

  const midA = ia.subarray(pre, ia.length - suf);
  const midB = ib.subarray(pre, ib.length - suf);
  let midOps = myers(midA, midB, DIFF_MAX_EDITS);
  const approximate = midOps === null;
  if (!midOps) {
    midOps = [];
    for (let i = 0; i < midA.length; i++) midOps.push({ t: DEL, a: i, b: 0 });
    for (let j = 0; j < midB.length; j++) midOps.push({ t: INS, a: midA.length, b: j });
  }

  const ops: Op[] = [];
  for (let i = 0; i < pre; i++) ops.push({ t: EQ, a: i, b: i });
  for (const o of midOps) ops.push({ t: o.t, a: o.a + pre, b: o.b + pre });
  for (let i = suf; i > 0; i--) ops.push({ t: EQ, a: ia.length - i, b: ib.length - i });

  const rows: DiffRow[] = [];
  const stats: DiffStats = { added: 0, removed: 0, changed: 0, matching: 0 };
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === EQ) {
      const o = ops[i++];
      rows.push({ type: 'equal', aNo: o.a + 1, bNo: o.b + 1, text: bLines[o.b] });
      stats.matching++;
      continue;
    }
    // A hunk: consecutive removals and additions. Pair them up in order as changed lines.
    const dels: Op[] = [];
    const inss: Op[] = [];
    while (i < ops.length && ops[i].t !== EQ) (ops[i].t === DEL ? dels : inss).push(ops[i++]);
    // Pairing very different hunks wholesale is noise; only pair when the hunk is modest.
    const pairs = approximate ? 0 : Math.min(dels.length, inss.length);
    for (let p = 0; p < pairs; p++) {
      const a = aLines[dels[p].a];
      const b = bLines[inss[p].b];
      rows.push({ type: 'changed', aNo: dels[p].a + 1, bNo: inss[p].b + 1, ...inlineDiff(a, b, opts) });
      stats.changed++;
    }
    for (let p = pairs; p < dels.length; p++) {
      rows.push({ type: 'removed', aNo: dels[p].a + 1, text: aLines[dels[p].a] });
      stats.removed++;
    }
    for (let p = pairs; p < inss.length; p++) {
      rows.push({ type: 'added', bNo: inss[p].b + 1, text: bLines[inss[p].b] });
      stats.added++;
    }
  }
  return { rows, stats, approximate, identical: stats.added + stats.removed + stats.changed === 0 };
}

/** Plain-text unified view for copying. */
export function diffToText(r: DiffResult): string {
  return r.rows
    .map((row) => {
      switch (row.type) {
        case 'equal':
          return '  ' + row.text;
        case 'removed':
          return '- ' + row.text;
        case 'added':
          return '+ ' + row.text;
        case 'changed':
          return '- ' + row.a.map((s) => s.text).join('') + '\n+ ' + row.b.map((s) => s.text).join('');
      }
    })
    .join('\n');
}
