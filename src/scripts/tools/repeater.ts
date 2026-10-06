import { checkRepeat, repeatText, separatorFor, REPEAT_MAX_CHARS, REPEAT_MAX_COUNT, type SeparatorId } from '../../../shared/text/generate';
import { track } from '../analytics';
import { editor } from '../editor';
import { result } from '../result';
import { announce, fmt, onPrimary } from '../ui';

const ed = editor('rep-text');
const out = result('rep-result');
const form = document.querySelector<HTMLElement>('[data-rep-opts]')!;
const countIn = form.querySelector<HTMLInputElement>('[name="count"]')!;
const customWrap = form.querySelector<HTMLElement>('[data-custom]')!;
const customIn = form.querySelector<HTMLInputElement>('[name="custom"]')!;
const btn = document.querySelector<HTMLButtonElement>('[data-act="repeat"]')!;
const size = document.querySelector<HTMLElement>('[data-rep-size]')!;

let confirmed = false;

const sepId = () => (form.querySelector<HTMLInputElement>('[name="sep"]:checked')?.value ?? 'newline') as SeparatorId;
const sep = () => separatorFor(sepId(), customIn.value);
const count = () => Math.floor(Number(countIn.value));

function human(chars: number) {
  if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)} million characters`;
  return `${fmt(chars)} characters`;
}

function check() {
  customWrap.hidden = sepId() !== 'custom';
  confirmed = false;
  btn.textContent = 'Repeat text';
  const c = checkRepeat(ed.value, count(), sep());
  size.classList.remove('is-warn', 'is-error');
  if (!c.ok) {
    btn.disabled = true;
    if (c.reason === 'empty') size.textContent = 'Type the text you want to repeat.';
    else if (c.reason === 'count') {
      size.textContent = `Choose a number from 1 to ${fmt(REPEAT_MAX_COUNT)}.`;
      size.classList.add('is-error');
    } else {
      size.textContent = `That would be ${human(c.size)}. The limit is ${human(REPEAT_MAX_CHARS)}, to keep your browser responsive.`;
      size.classList.add('is-error');
    }
    return c;
  }
  btn.disabled = false;
  size.textContent = `Output: ${human(c.size)}`;
  if (c.warn) {
    size.textContent += '. That is very large and may take a moment.';
    size.classList.add('is-warn');
  }
  return c;
}

function run() {
  // Don't call check() here: it resets the confirmation step.
  const c = checkRepeat(ed.value, count(), sep());
  if (!c.ok) return;
  if (c.warn && !confirmed) {
    confirmed = true;
    btn.textContent = `Create ${human(c.size)}`;
    announce(`The output will be ${human(c.size)}. Select the button again to create it.`);
    return;
  }
  out.set(repeatText(ed.value, count(), sep()));
  out.meta(`Repeated <strong class="num">${fmt(count())}</strong> times.`);
  announce(`Text repeated ${count()} times.`);
  track('tool_action', { action: 'repeat', option: sepId() });
  confirmed = false;
  btn.textContent = 'Repeat text';
}

ed.onInput(check);
form.addEventListener('input', check);
form.addEventListener('change', check);
btn.addEventListener('click', run);
onPrimary(run);
check();
