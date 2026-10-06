import { lorem, LOREM_MAX, type LoremUnit } from '../../../shared/text/generate';
import { countWords } from '../../../shared/text/stats';
import { track } from '../analytics';
import { result } from '../result';
import { announce, fmt, onPrimary, plural } from '../ui';

const out = result('lorem-result');
const form = document.querySelector<HTMLElement>('[data-lorem-opts]')!;
const q = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`)!;
const count = q('count');
const limit = document.querySelector<HTMLElement>('[data-lorem-limit]')!;

const unit = () => (form.querySelector<HTMLInputElement>('[name="unit"]:checked')?.value ?? 'paragraphs') as LoremUnit;

function syncMax() {
  const max = LOREM_MAX[unit()];
  count.max = String(max);
  const n = Math.floor(Number(count.value));
  limit.textContent = n > max ? `The most you can generate at once is ${fmt(max)} ${unit()}, so we made ${fmt(max)}.` : '';
}

function generate(userAction = true) {
  syncMax();
  const text = lorem({ unit: unit(), count: Number(count.value) || 1, startWithLorem: q('lorem').checked, html: q('html').checked });
  out.set(text);
  out.meta(`${plural(countWords(text.replace(/<\/?p>/g, ' ')), 'word')}`);
  if (userAction) {
    announce('Placeholder text generated.');
    track('tool_action', { action: 'generate', option: unit() });
  }
}

form.querySelector('[data-act="generate"]')!.addEventListener('click', () => generate());
onPrimary(() => generate());
count.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});
form.addEventListener('change', syncMax);
generate(false);
