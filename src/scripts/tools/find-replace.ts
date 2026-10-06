import type { FindOptions } from '../../../shared/text/find';
import { track } from '../analytics';
import { compute, CancelledError, TimeoutError } from '../compute';
import { editor } from '../editor';
import { result } from '../result';
import { announce, fmt, onPrimary, plural } from '../ui';

const ed = editor('fr-text');
const out = result('fr-result');
const panel = document.querySelector<HTMLElement>('[data-fr]')!;
const input = (n: string) => panel.querySelector<HTMLInputElement>(`[name="${n}"]`)!;
const status = panel.querySelector<HTMLElement>('[data-status]')!;
const help = panel.querySelector<HTMLElement>('[data-regex-help]')!;
const allBtn = panel.querySelector<HTMLButtonElement>('[data-act="replace-all"]')!;
const firstBtn = panel.querySelector<HTMLButtonElement>('[data-act="replace-first"]')!;

const TOO_SLOW = 'This pattern takes too long to run on your text, so we stopped it. Try a simpler pattern.';

const opts = (): FindOptions => ({
  find: input('find').value,
  replace: input('replace').value,
  caseSensitive: input('caseSensitive').checked,
  wholeWord: input('wholeWord').checked,
  regex: input('regex').checked,
});

function setStatus(text: string, error = false) {
  status.textContent = text;
  status.classList.toggle('is-error', error);
}

let matches = 0;
let timer = 0;

async function count() {
  const o = opts();
  help.hidden = !o.regex;
  if (!o.find || !ed.value) {
    matches = 0;
    setStatus(o.find && !ed.value ? 'Add some text to search.' : '');
    allBtn.disabled = firstBtn.disabled = true;
    return;
  }
  try {
    const r = await compute<{ ok: true; count: number } | { ok: false; error: string }>(
      { op: 'count', text: ed.value, find: { find: o.find, caseSensitive: o.caseSensitive, wholeWord: o.wholeWord, regex: o.regex } },
      1500,
    );
    if (!r.ok) {
      matches = 0;
      setStatus(r.error, true);
    } else {
      matches = r.count;
      setStatus(matches ? `${plural(matches, 'match', 'matches')} found` : 'No matches');
    }
  } catch (e) {
    if (e instanceof CancelledError) return;
    matches = 0;
    setStatus(e instanceof TimeoutError ? TOO_SLOW : 'Please check your regular expression and try again.', true);
  }
  allBtn.disabled = firstBtn.disabled = matches === 0;
}

function scheduleCount() {
  clearTimeout(timer);
  timer = window.setTimeout(count, ed.value.length > 200_000 ? 300 : 120);
}

async function replace(mode: 'first' | 'all') {
  const o = opts();
  if (!o.find || !ed.value || matches === 0) return;
  try {
    const r = await compute<{ ok: true; text: string; replaced: number } | { ok: false; error: string }>(
      { op: 'replace', text: ed.value, find: o, mode },
      5000,
    );
    if (!r.ok) {
      setStatus(r.error, true);
      return;
    }
    out.set(r.text);
    out.meta(`<strong class="num">${fmt(r.replaced)}</strong> ${r.replaced === 1 ? 'replacement' : 'replacements'} made.`);
    announce(`${plural(r.replaced, 'replacement')} made. The result is below.`);
    track('tool_action', { action: mode === 'all' ? 'replace_all' : 'replace_first', option: o.regex ? 'regex' : 'plain' });
  } catch (e) {
    if (e instanceof CancelledError) return;
    setStatus(e instanceof TimeoutError ? TOO_SLOW : 'Please check your regular expression and try again.', true);
  }
}

ed.onInput(scheduleCount);
panel.addEventListener('input', scheduleCount);
panel.addEventListener('change', () => {
  help.hidden = !input('regex').checked;
  scheduleCount();
});
allBtn.addEventListener('click', () => replace('all'));
firstBtn.addEventListener('click', () => replace('first'));
onPrimary(() => replace('all'));
for (const n of ['find', 'replace']) {
  input(n).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      replace('all');
    }
  });
}
