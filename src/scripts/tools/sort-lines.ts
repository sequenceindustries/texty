import { sortLines, type SortOptions } from '../../../shared/text/lines';
import { track } from '../analytics';
import { editor } from '../editor';
import { result } from '../result';
import { announce, fmt, scheduler } from '../ui';

const ed = editor('sort-text');
const out = result('sort-result');
const modes = document.querySelector<HTMLFieldSetElement>('[data-sort-mode]')!;
const opts = document.querySelector<HTMLElement>('[data-sort-opts]')!;
const reshuffle = document.querySelector<HTMLButtonElement>('[data-act="reshuffle"]')!;

const options = (): SortOptions => ({
  mode: (modes.querySelector<HTMLInputElement>('input:checked')?.value ?? 'az') as SortOptions['mode'],
  caseSensitive: opts.querySelector<HTMLInputElement>('[name="caseSensitive"]')!.checked,
  blankLines: opts.querySelector<HTMLSelectElement>('[name="blankLines"]')!.value as SortOptions['blankLines'],
});

function render() {
  const o = options();
  reshuffle.hidden = o.mode !== 'random';
  if (!ed.value) {
    out.set('');
    out.meta('');
    return;
  }
  const r = sortLines(ed.value, o);
  out.set(r.text);
  const dropped = r.before - r.after;
  out.meta(`<strong class="num">${fmt(r.after)}</strong> lines sorted.${dropped ? ` ${fmt(dropped)} blank removed.` : ''}`);
}

ed.onInput(scheduler(render, () => ed.value.length));
modes.addEventListener('change', () => {
  render();
  track('tool_action', { action: options().mode });
});
opts.addEventListener('change', render);
reshuffle.addEventListener('click', () => {
  render();
  announce('Shuffled again.');
  track('tool_action', { action: 'reshuffle' });
});
render();
