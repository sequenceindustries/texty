import { charStats, countCharacters, smsInfo } from '../../../shared/text/stats';
import { editor } from '../editor';
import { fmt, plural, scheduler } from '../ui';

const ed = editor('cc-text');
const root = document.querySelector<HTMLElement>('[data-cc]')!;
const cells = new Map([...root.querySelectorAll<HTMLElement>('[data-stat]')].map((el) => [el.dataset.stat!, el]));
const limits = [...root.querySelectorAll<HTMLElement>('[data-limit]')];
const sms = root.querySelector<HTMLElement>('[data-sms]')!;

function setRow(li: HTMLElement, used: number, max: number, text: string) {
  li.classList.toggle('is-over', used > max);
  li.querySelector<HTMLElement>('[data-status]')!.textContent = text;
  li.querySelector<HTMLElement>('[data-bar]')!.style.width = `${Math.min(100, (used / max) * 100)}%`;
}

function render() {
  const text = ed.value;
  const s = charStats(text);
  for (const [k, v] of Object.entries(s)) {
    const el = cells.get(k);
    if (el) el.textContent = fmt(v);
  }
  const chars = countCharacters(text);
  for (const li of limits) {
    const max = Number(li.dataset.max);
    const over = chars - max;
    setRow(li, chars, max, over > 0 ? `${fmt(over)} over (${fmt(chars)} / ${fmt(max)})` : `${fmt(chars)} / ${fmt(max)}`);
  }
  const info = smsInfo(text.length > 20_000 ? text.slice(0, 20_000) : text);
  const msg =
    info.units === 0 ? 'Empty' : text.length > 20_000 ? 'Too long for SMS' : `${plural(info.segments, 'message')}, ${fmt(info.remaining)} left`;
  setRow(sms, info.segments <= 1 ? info.units : info.perSegment, info.segments <= 1 ? info.perSegment : info.perSegment, msg);
  // The bar shows how full the current message is.
  const bar = sms.querySelector<HTMLElement>('[data-bar]')!;
  bar.style.width = info.units === 0 ? '0%' : `${((info.perSegment - info.remaining) / info.perSegment) * 100}%`;
  sms.classList.toggle('is-over', info.segments > 1);
  sms.querySelector<HTMLElement>('[data-note]')!.textContent =
    info.units === 0
      ? '160 characters per message, or 70 if it contains emoji or other special characters.'
      : info.encoding === 'GSM-7'
        ? `Standard characters: ${info.segments > 1 ? '153 per part when split' : '160 per message'}.`
        : `Contains emoji or special characters, so it sends as Unicode: ${info.segments > 1 ? '67 per part when split' : '70 per message'}.`;
}

ed.onInput(scheduler(render, () => ed.value.length));
render();
