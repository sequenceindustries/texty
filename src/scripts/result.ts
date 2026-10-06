/**
 * Behaviour for the ResultPanel component: shows output in a read-only text
 * area (fast even for megabytes of text), with copy and download.
 * Very large output is previewed; copy and download always use the full text.
 */
import { track } from './analytics';
import { copyWithFeedback, downloadText, fmt } from './ui';

/** Output longer than this is previewed rather than put in the page whole. */
export const DISPLAY_MAX = 1_000_000;

export interface Result {
  set(text: string): void;
  clear(): void;
  readonly value: string;
  /** Short status under the header, e.g. "Before: 5 lines · After: 3 lines". */
  meta(html: string): void;
}

const mounted = new Map<string, Result>();

export function result(id: string): Result {
  const existing = mounted.get(id);
  if (existing) return existing;
  const root = document.querySelector<HTMLElement>(`[data-result="${id}"]`);
  if (!root) throw new Error(`No result panel ${id}`);
  const out = root.querySelector<HTMLTextAreaElement>('textarea');
  const metaEl = root.querySelector<HTMLElement>('[data-result-meta]');
  const note = root.querySelector<HTMLElement>('[data-result-note]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-act="copy-result"]');
  const dlBtn = root.querySelector<HTMLButtonElement>('[data-act="download-result"]');
  const filename = root.dataset.filename || 'texty.txt';
  let full = '';

  const sync = () => {
    const empty = full.length === 0;
    if (copyBtn) copyBtn.disabled = empty;
    if (dlBtn) dlBtn.disabled = empty;
    root.classList.toggle('is-empty', empty);
  };

  copyBtn?.addEventListener('click', () => copyWithFeedback(copyBtn, full, 'Result'));
  dlBtn?.addEventListener('click', () => {
    if (!full) return;
    downloadText(full, filename);
    track('download_clicked', { option: 'txt' });
  });

  const api: Result = {
    set(text: string) {
      full = text;
      if (out) {
        if (text.length > DISPLAY_MAX) {
          out.value = text.slice(0, DISPLAY_MAX);
          if (note) {
            note.textContent = `Showing the first ${fmt(DISPLAY_MAX)} of ${fmt(text.length)} characters. Copy and download include everything.`;
            note.hidden = false;
          }
        } else {
          out.value = text;
          if (note) note.hidden = true;
        }
      }
      sync();
    },
    clear() {
      api.set('');
    },
    get value() {
      return full;
    },
    meta(html: string) {
      if (metaEl) metaEl.innerHTML = html;
    },
  };
  mounted.set(id, api);
  sync();
  return api;
}
