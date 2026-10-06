import { wordStats, wordFrequency } from '../../../shared/text/stats';
import { editor } from '../editor';
import { fmt, scheduler } from '../ui';

const ed = editor('wc-text');
const root = document.querySelector<HTMLElement>('[data-wc]')!;
const cells = new Map([...root.querySelectorAll<HTMLElement>('[data-stat]')].map((el) => [el.dataset.stat!, el]));
const freq = root.querySelector<HTMLDetailsElement>('[data-freq]')!;
const skip = root.querySelector<HTMLInputElement>('[data-skip-common]')!;
const table = root.querySelector<HTMLTableElement>('[data-freq-table]')!;
const empty = root.querySelector<HTMLElement>('[data-freq-empty]')!;

function renderStats() {
  const s = wordStats(ed.value);
  for (const [k, v] of Object.entries(s)) {
    const el = cells.get(k);
    if (el) el.textContent = typeof v === 'number' ? fmt(v) : v;
  }
  if (freq.open) renderFrequency();
}

function renderFrequency() {
  const rows = wordFrequency(ed.value, { limit: 20, skipCommon: skip.checked });
  empty.hidden = rows.length > 0;
  table.hidden = rows.length === 0;
  const max = rows[0]?.count ?? 1;
  const tbody = table.tBodies[0];
  tbody.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      const word = document.createElement('td');
      word.textContent = r.word;
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.width = `${Math.max(4, (r.count / max) * 100)}%`;
      word.append(bar);
      const count = document.createElement('td');
      count.className = 'r num';
      count.textContent = fmt(r.count);
      const share = document.createElement('td');
      share.className = 'r num';
      share.textContent = `${(r.share * 100).toFixed(1)}%`;
      tr.append(word, count, share);
      return tr;
    }),
  );
}

const schedule = scheduler(renderStats, () => ed.value.length);
ed.onInput(schedule);
freq.addEventListener('toggle', () => freq.open && renderFrequency());
skip.addEventListener('change', renderFrequency);
renderStats();
