import { slugifyLines, type SlugOptions } from '../../../shared/text/generate';
import { editor } from '../editor';
import { result } from '../result';
import { scheduler } from '../ui';

const ed = editor('slug-text');
const out = result('slug-result');
const form = document.querySelector<HTMLElement>('[data-slug-opts]')!;
const q = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`)!;
const copyBtn = document.querySelector<HTMLButtonElement>('[data-result="slug-result"] [data-act="copy-result"] [data-label]')!;

const options = (): SlugOptions => ({
  separator: (form.querySelector<HTMLInputElement>('[name="sep"]:checked')?.value ?? '-') as SlugOptions['separator'],
  lowercase: q('lowercase').checked,
  asciiOnly: q('ascii').checked,
  maxLength: Math.max(0, Math.min(500, Math.floor(Number(q('max').value) || 0))),
});

function render() {
  const text = ed.value.length > 200_000 ? ed.value.slice(0, 200_000) : ed.value;
  const slugs = slugifyLines(text, options());
  out.set(slugs);
  const n = slugs ? slugs.split('\n').length : 0;
  copyBtn.textContent = n > 1 ? 'Copy slugs' : 'Copy slug';
  out.meta(ed.value.trim() && !slugs ? 'There are no letters or numbers to make a slug from.' : n > 1 ? `${n} slugs` : '');
}

ed.onInput(scheduler(render, () => ed.value.length));
form.addEventListener('input', render);
form.addEventListener('change', render);
render();
