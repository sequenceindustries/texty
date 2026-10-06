/**
 * Behaviour for the TextEditor component: toolbar (paste, copy, select all,
 * clear with undo), live mini statistics, large-text warnings and the
 * Ctrl/⌘+Enter shortcut for the page's main action.
 */
import { countCharacters, countWords } from '../../shared/text/stats';
import { trackInput } from './analytics';
import { LARGE_TEXT, MAX_TEXT, announce, copyWithFeedback, fmt, plural, scheduler } from './ui';

export interface Editor {
  el: HTMLTextAreaElement;
  value: string;
  set(value: string): void;
  onInput(cb: (value: string) => void): void;
  focus(): void;
}

const mounted = new WeakMap<HTMLElement, Editor>();

export function editor(id: string): Editor {
  const root = document.querySelector<HTMLElement>(`[data-editor="${id}"]`);
  if (!root) throw new Error(`No editor ${id}`);
  return mounted.get(root) ?? mount(root);
}

function mount(root: HTMLElement): Editor {
  const ta = root.querySelector('textarea')!;
  const stats = root.querySelector<HTMLElement>('[data-mini]');
  const notice = root.querySelector<HTMLElement>('[data-size-notice]');
  const btn = (name: string) => root.querySelector<HTMLButtonElement>(`[data-act="${name}"]`);
  const pasteBtn = btn('paste');
  const copyBtn = btn('copy');
  const selectBtn = btn('select');
  const clearBtn = btn('clear');
  const undoBtn = btn('undo');
  const maxChars = Number(root.dataset.max) || 0;
  const listeners: ((v: string) => void)[] = [];
  let undoValue: string | null = null;
  let undoTimer = 0;

  const refreshStats = () => {
    const v = ta.value;
    if (stats) {
      const chars = countCharacters(v);
      const words = countWords(v);
      stats.textContent = maxChars
        ? `${plural(words, 'word')}, ${fmt(chars)} / ${fmt(maxChars)} characters`
        : `${plural(words, 'word')}, ${plural(chars, 'character')}`;
      stats.classList.toggle('is-over', maxChars > 0 && chars > maxChars);
    }
    if (notice) {
      let msg = '';
      if (v.length >= MAX_TEXT) msg = `Texty handles up to ${fmt(MAX_TEXT)} characters at a time, so the rest was not added.`;
      else if (v.length > LARGE_TEXT) msg = 'This text is very large. Some operations may take longer.';
      notice.textContent = msg;
      notice.hidden = !msg;
    }
  };
  const scheduleStats = scheduler(refreshStats, () => ta.value.length);

  const syncButtons = () => {
    const empty = ta.value.length === 0;
    for (const b of [copyBtn, selectBtn, clearBtn]) if (b) b.disabled = empty;
  };

  const emit = () => {
    syncButtons();
    scheduleStats();
    trackInput(ta.value.length);
    for (const cb of listeners) cb(ta.value);
  };

  const hideUndo = () => {
    undoValue = null;
    if (undoBtn) undoBtn.hidden = true;
    if (clearBtn) clearBtn.hidden = false;
  };

  ta.addEventListener('input', () => {
    if (undoValue !== null && ta.value) hideUndo();
    emit();
  });

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('texty:primary'));
    }
  });

  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        announce('Your clipboard is empty.');
        return;
      }
      ta.focus();
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      emit();
      announce('Pasted.');
    } catch {
      ta.focus();
      announce('Your browser blocked pasting from this button. Press Ctrl+V (⌘V on Mac) to paste.');
      if (pasteBtn) {
        const tip = root.querySelector<HTMLElement>('[data-paste-tip]');
        if (tip) {
          tip.hidden = false;
          setTimeout(() => (tip.hidden = true), 5000);
        }
      }
    }
  });

  copyBtn?.addEventListener('click', () => copyWithFeedback(copyBtn, ta.value));

  selectBtn?.addEventListener('click', () => {
    ta.focus();
    ta.select();
  });

  clearBtn?.addEventListener('click', () => {
    if (!ta.value) return;
    undoValue = ta.value;
    ta.value = '';
    emit();
    ta.focus();
    if (undoBtn) {
      undoBtn.hidden = false;
      clearBtn.hidden = true;
    }
    announce('Text cleared. Select Undo to bring it back.');
    clearTimeout(undoTimer);
    undoTimer = window.setTimeout(hideUndo, 10_000);
  });

  undoBtn?.addEventListener('click', () => {
    if (undoValue === null) return;
    ta.value = undoValue;
    hideUndo();
    emit();
    ta.focus();
    announce('Text restored.');
  });

  const api: Editor = {
    el: ta,
    get value() {
      return ta.value;
    },
    set(value: string) {
      ta.value = value;
      emit();
    },
    onInput(cb) {
      listeners.push(cb);
    },
    focus() {
      ta.focus();
    },
  };
  mounted.set(root, api);
  // The browser may restore text on back/forward navigation.
  if (ta.value) queueMicrotask(emit);
  else syncButtons();
  return api;
}
