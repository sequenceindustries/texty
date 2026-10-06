import { cleanText, type CleanOptions } from '../../../shared/text/clean';
import { track } from '../analytics';
import { editor } from '../editor';
import { result } from '../result';
import { announce, plural, scheduler } from '../ui';

const ed = editor('clean-text');
const out = result('clean-result');
const form = document.querySelector<HTMLFieldSetElement>('[data-clean-opts]')!;
const applyBtn = document.querySelector<HTMLButtonElement>('[data-result="clean-result"] [data-act="apply"]')!;
const applyLabel = applyBtn.querySelector<HTMLElement>('[data-label]')!;
let undoValue: string | null = null;
let undoTimer = 0;

const opt = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!.checked;
const options = (): CleanOptions => ({
  collapseSpaces: opt('collapseSpaces'),
  trimLines: opt('trimLines'),
  trimText: opt('trimText'),
  normalizeLineBreaks: opt('normalizeLineBreaks'),
  removeInvisible: opt('removeInvisible'),
  straightenQuotes: opt('straightenQuotes'),
  blankLines: form.querySelector<HTMLSelectElement>('[name="blankLines"]')!.value as CleanOptions['blankLines'],
});

function render() {
  if (!ed.value) {
    out.set('');
    out.meta('');
    applyBtn.disabled = undoValue === null;
    return;
  }
  const r = cleanText(ed.value, options());
  out.set(r.text);
  const parts: string[] = [];
  const { report: rep } = r;
  if (rep.spaces) parts.push(plural(rep.spaces, 'extra space'));
  if (rep.trimmedLines) parts.push(plural(rep.trimmedLines, 'line') + ' trimmed');
  if (rep.blankLines) parts.push(plural(rep.blankLines, 'blank line'));
  if (rep.invisible) parts.push(plural(rep.invisible, 'hidden character'));
  if (rep.lineBreaks) parts.push(plural(rep.lineBreaks, 'line break') + ' normalised');
  if (rep.quotes) parts.push(plural(rep.quotes, 'quote') + ' straightened');
  out.meta(r.changed ? (parts.length ? 'Fixes: ' + parts.join(', ') : 'Whitespace tidied') : 'Nothing to clean with these options');
  applyBtn.disabled = !r.changed && undoValue === null;
}

function resetUndo() {
  undoValue = null;
  applyLabel.textContent = 'Clean text';
}

applyBtn.addEventListener('click', () => {
  if (undoValue !== null) {
    const v = undoValue;
    resetUndo();
    ed.set(v);
    announce('Original text restored.');
    return;
  }
  const cleaned = out.value;
  if (!cleaned && !ed.value) return;
  const before = ed.value;
  ed.set(cleaned);
  undoValue = before;
  applyLabel.textContent = 'Undo clean';
  applyBtn.disabled = false;
  announce('Text cleaned. Select Undo clean to restore the original.');
  track('tool_action', { action: 'clean' });
  clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => {
    resetUndo();
    render();
  }, 15_000);
});

ed.el.addEventListener('input', () => {
  if (undoValue !== null) resetUndo();
});
ed.onInput(scheduler(render, () => ed.value.length));
form.addEventListener('change', render);
render();
