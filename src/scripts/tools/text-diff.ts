import { diffToText, DIFF_MAX_LINES, type DiffResult, type DiffRow, type Segment } from '../../../shared/text/diff';
import { track } from '../analytics';
import { compute, CancelledError, TimeoutError } from '../compute';
import { editor } from '../editor';
import { result } from '../result';
import { announce, fmt, onPrimary, plural } from '../ui';

const a = editor('diff-a');
const b = editor('diff-b');
const out = result('diff-result');
const controls = document.querySelector<HTMLElement>('[data-diff-controls]')!;
const compareBtn = controls.querySelector<HTMLButtonElement>('[data-act="compare"]')!;
const processing = document.querySelector<HTMLElement>('[data-processing="diff"]')!;
const cancelBtn = processing.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;
const view = document.querySelector<HTMLElement>('[data-diff-view]')!;
const legend = document.querySelector<HTMLElement>('[data-diff-legend]')!;
const errorEl = document.querySelector<HTMLElement>('[data-diff-error]')!;

/** Rows rendered at most; the full comparison is still available to copy and download. */
const MAX_ROWS = 3000;
/** Unchanged runs longer than this are folded, keeping this many lines of context each side. */
const CONTEXT = 3;

const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const srOnly = (text: string) => el('span', 'visually-hidden', text);

function segs(parent: HTMLElement, list: Segment[], tag: 'del' | 'ins') {
  for (const s of list) parent.append(s.changed ? el(tag, undefined, s.text) : document.createTextNode(s.text));
}

function rowEl(row: DiffRow): HTMLElement {
  const r = el('div', 'r');
  const mk = el('span', 'mk');
  mk.setAttribute('aria-hidden', 'true');
  const la = el('span', 'ln ln--a');
  const lb = el('span', 'ln ln--b');
  const tx = el('span', 'tx');
  switch (row.type) {
    case 'equal':
      la.textContent = String(row.aNo);
      lb.textContent = String(row.bNo);
      tx.textContent = row.text || ' ';
      break;
    case 'added':
      r.classList.add('r--add');
      mk.textContent = '+';
      lb.textContent = String(row.bNo);
      tx.append(srOnly('Added: '), row.text || ' ');
      break;
    case 'removed':
      r.classList.add('r--del');
      mk.textContent = '−';
      la.textContent = String(row.aNo);
      tx.append(srOnly('Removed: '), row.text || ' ');
      break;
    case 'changed': {
      r.classList.add('r--chg');
      mk.textContent = '~';
      la.textContent = String(row.aNo);
      lb.textContent = String(row.bNo);
      const before = el('span');
      before.append(srOnly('Changed from: '));
      segs(before, row.a, 'del');
      const after = el('span');
      after.append(srOnly('to: '));
      segs(after, row.b, 'ins');
      tx.append(before, after);
      break;
    }
  }
  r.append(mk, la, lb, tx);
  return r;
}

function render(d: DiffResult) {
  const frag = document.createDocumentFragment();
  let shown = 0;
  const rows = d.rows;
  let i = 0;
  while (i < rows.length && shown < MAX_ROWS) {
    if (rows[i].type === 'equal') {
      let j = i;
      while (j < rows.length && rows[j].type === 'equal') j++;
      const run = rows.slice(i, j);
      const headKeep = i === 0 ? 0 : CONTEXT;
      const tailKeep = j === rows.length ? 0 : CONTEXT;
      if (run.length > headKeep + tailKeep + 2) {
        for (const r of run.slice(0, headKeep)) frag.append(rowEl(r));
        const hidden = run.slice(headKeep, run.length - tailKeep);
        const fold = el('button', 'fold', `Show ${plural(hidden.length, 'unchanged line')}`) as HTMLButtonElement;
        fold.type = 'button';
        fold.addEventListener('click', () => {
          const f = document.createDocumentFragment();
          for (const r of hidden.slice(0, MAX_ROWS)) f.append(rowEl(r));
          fold.replaceWith(f);
        });
        frag.append(fold);
        for (const r of run.slice(run.length - tailKeep)) frag.append(rowEl(r));
        shown += headKeep + tailKeep + 1;
      } else {
        for (const r of run) frag.append(rowEl(r));
        shown += run.length;
      }
      i = j;
    } else {
      frag.append(rowEl(rows[i++]));
      shown++;
    }
  }
  if (i < rows.length) frag.append(el('p', 'more', `The comparison is long, so only the first part is shown here. Copy or download it to see everything.`));
  view.replaceChildren(frag);
}

let running = false;

async function run() {
  if (running) return;
  errorEl.hidden = true;
  if (!a.value && !b.value) {
    errorEl.textContent = 'Paste some text into both boxes to compare them.';
    errorEl.hidden = false;
    return;
  }
  const lines = (s: string) => s.split('\n').length;
  if (lines(a.value) > DIFF_MAX_LINES || lines(b.value) > DIFF_MAX_LINES) {
    errorEl.textContent = `Each text can have up to ${fmt(DIFF_MAX_LINES)} lines. Please compare a smaller section.`;
    errorEl.hidden = false;
    return;
  }
  running = true;
  compareBtn.disabled = true;
  const started = performance.now();
  const showTimer = window.setTimeout(() => (processing.hidden = false), 250);
  const options = {
    ignoreWhitespace: controls.querySelector<HTMLInputElement>('[name="ignoreWhitespace"]')!.checked,
    ignoreCase: controls.querySelector<HTMLInputElement>('[name="ignoreCase"]')!.checked,
  };
  try {
    const r = await compute<{ ok: true; diff: DiffResult } | { ok: false; error: string }>({ op: 'diff', a: a.value, b: b.value, options }, 15_000);
    if (!r.ok) throw new Error(r.error);
    const d = r.diff;
    const s = d.stats;
    legend.hidden = d.identical;
    if (d.identical) {
      view.replaceChildren(el('p', 'placeholder', 'The two texts are the same.'));
      out.meta(`No differences. <strong class="num">${fmt(s.matching)}</strong> matching lines.`);
      out.set('');
      announce('The two texts are the same.');
    } else {
      render(d);
      out.meta(
        `<strong class="num">${fmt(s.added)}</strong> added, <strong class="num">${fmt(s.removed)}</strong> removed, ` +
          `<strong class="num">${fmt(s.changed)}</strong> changed, <strong class="num">${fmt(s.matching)}</strong> matching` +
          (d.approximate ? '. These texts are very different, so changes are shown as whole blocks.' : ''),
      );
      out.set(diffToText(d));
      announce(`${s.added} lines added, ${s.removed} removed, ${s.changed} changed.`);
    }
    track('tool_action', { action: 'compare', ms: Math.round(performance.now() - started) });
  } catch (e) {
    if (!(e instanceof CancelledError)) {
      errorEl.textContent =
        e instanceof TimeoutError
          ? 'Comparing these texts took too long, so we stopped. Try comparing smaller sections.'
          : 'Something went wrong while comparing. Please try again.';
      errorEl.hidden = false;
    }
  } finally {
    clearTimeout(showTimer);
    processing.hidden = true;
    compareBtn.disabled = false;
    running = false;
  }
}

compareBtn.addEventListener('click', run);
onPrimary(run);
cancelBtn.addEventListener('click', () => {
  // Starting an empty job cancels the running one.
  compute({ op: 'count', text: '', find: { find: 'x', caseSensitive: false, wholeWord: false, regex: false } }, 1000).catch(() => {});
  announce('Comparison stopped.');
});
