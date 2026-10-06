import { removeDuplicateLines, type DedupeOptions } from '../../../shared/text/lines';
import { track } from '../analytics';
import { editor } from '../editor';
import { result } from '../result';
import { fmt, plural, scheduler } from '../ui';

const ed = editor('dedupe-text');
const out = result('dedupe-result');
const form = document.querySelector<HTMLFieldSetElement>('[data-dedupe-opts]')!;
const checked = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`)!.checked;

const options = (): DedupeOptions => ({
  keep: (form.querySelector<HTMLInputElement>('[name="keep"]:checked')?.value ?? 'first') as DedupeOptions['keep'],
  caseSensitive: !checked('ignoreCase'),
  ignoreWhitespace: checked('ignoreWhitespace'),
  preserveOrder: checked('preserveOrder'),
  removeBlank: checked('removeBlank'),
});

function render() {
  if (!ed.value) {
    out.set('');
    out.meta('');
    return;
  }
  const r = removeDuplicateLines(ed.value, options());
  out.set(r.text);
  const removed = r.before - r.after;
  out.meta(
    `Before: <strong class="num">${fmt(r.before)}</strong> lines. After: <strong class="num">${fmt(r.after)}</strong> lines. ` +
      (removed ? `${plural(removed, 'line')} removed.` : 'No duplicates found.'),
  );
}

ed.onInput(scheduler(render, () => ed.value.length));
form.addEventListener('change', (e) => {
  render();
  track('tool_action', { option: (e.target as HTMLInputElement).name });
});
render();
