/** Small shared browser helpers: copy, download, announcements, scheduling, formatting. */
import { track } from './analytics';

/** Above this, the page warns that operations may take longer. */
export const LARGE_TEXT = 500_000;
/** The most any editor accepts. */
export const MAX_TEXT = 5_000_000;

const nf = new Intl.NumberFormat('en');
export const fmt = (n: number) => nf.format(n);
export const plural = (n: number, one: string, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}
export function $$<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(sel)];
}

/** Polite screen-reader announcement via the page's live region. */
export function announce(message: string) {
  const region = document.getElementById('announcer');
  if (!region) return;
  region.textContent = '';
  // A fresh text node in the next frame makes repeated messages announce again.
  requestAnimationFrame(() => (region.textContent = message));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers or contexts without the async clipboard.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Briefly swap a button's label to confirm an action, then restore it. */
export function flash(btn: HTMLElement, label: string, ms = 1600) {
  const span = btn.querySelector<HTMLElement>('[data-label]') ?? btn;
  const original = span.dataset.original ?? span.textContent ?? '';
  span.dataset.original = original;
  span.textContent = label;
  btn.classList.add('is-done');
  clearTimeout(Number(btn.dataset.flashTimer));
  btn.dataset.flashTimer = String(
    window.setTimeout(() => {
      span.textContent = original;
      btn.classList.remove('is-done');
    }, ms),
  );
}

export async function copyWithFeedback(btn: HTMLElement, text: string, what = 'Text') {
  if (!text) return;
  const ok = await copyText(text);
  if (ok) {
    flash(btn, 'Copied');
    announce(`${what} copied to clipboard.`);
    track('copy_clicked', { option: btn.dataset.option });
  } else {
    flash(btn, 'Copy failed');
    announce('Copying was blocked by your browser. Select the text and press Ctrl+C (⌘C on Mac).');
  }
}

/**
 * Run fn after input settles: next frame for normal text, with a short delay
 * for very large text so typing stays smooth.
 */
export function scheduler(fn: () => void, sizeOf: () => number) {
  let raf = 0;
  let timer = 0;
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    const n = sizeOf();
    if (n > 200_000) timer = window.setTimeout(fn, n > 1_000_000 ? 400 : 180);
    else raf = requestAnimationFrame(fn);
  };
}

/** Prevent double-run when an action is triggered by key and click together. */
export function onPrimary(handler: () => void) {
  document.addEventListener('texty:primary', handler);
}
