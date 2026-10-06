import { AI_ERRORS, AI_LIMITS, isAiErrorCode, type RewriteAction } from '../../../shared/ai';
import { countCharacters } from '../../../shared/text/stats';
import { sizeBucket, track } from '../analytics';
import { editor } from '../editor';
import { announce, copyWithFeedback, onPrimary, plural } from '../ui';

const TOOL = 'ai-text-rewriter';
const ed = editor('ai-text');
const root = document.querySelector<HTMLElement>('[data-ai]')!;
const unavailable = root.querySelector<HTMLElement>('[data-ai-unavailable]')!;
const btn = root.querySelector<HTMLButtonElement>('[data-act="rewrite"]')!;
const againBtn = root.querySelector<HTMLButtonElement>('[data-act="again"]')!;
const useBtn = root.querySelector<HTMLButtonElement>('[data-act="use"]')!;
const copyBtn = root.querySelector<HTMLButtonElement>('[data-act="copy-result"]')!;
const processing = root.querySelector<HTMLElement>('[data-processing="ai"]')!;
const elapsed = processing.querySelector<HTMLElement>('[data-elapsed]')!;
const cancelBtn = processing.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;
const errorEl = root.querySelector<HTMLElement>('[data-ai-error]')!;
const output = root.querySelector<HTMLElement>('[data-ai-output]')!;
const origEl = root.querySelector<HTMLElement>('[data-ba="original"]')!;
const resEl = root.querySelector<HTMLElement>('[data-ba="result"]')!;
const quota = root.querySelector<HTMLElement>('[data-quota]')!;
const instruction = root.querySelector<HTMLInputElement>('[name="instruction"]')!;

let available = true;
let busy = false;
let ctrl: AbortController | null = null;
let resultText = '';

const action = () => (root.querySelector<HTMLInputElement>('[name="action"]:checked')?.value ?? 'rewrite') as RewriteAction;

function showQuota(n: number | undefined) {
  if (typeof n !== 'number') return;
  quota.textContent = n > 0 ? `${plural(n, 'free rewrite')} left today` : 'No free rewrites left today';
}

function sync() {
  const chars = countCharacters(ed.value);
  btn.disabled = busy || !available || !ed.value.trim() || chars > AI_LIMITS.maxInputChars;
  againBtn.disabled = btn.disabled;
  copyBtn.disabled = !resultText;
}

function showError(message: string) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  announce(message);
}

async function checkStatus() {
  try {
    const r = await fetch('/api/ai/status', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error();
    const s = await r.json();
    const t = s?.tools?.[TOOL];
    available = Boolean(t?.available);
    if (available) showQuota(t?.remainingToday);
  } catch {
    available = false;
  }
  unavailable.hidden = available;
  sync();
}

async function rewrite() {
  if (busy) return;
  const text = ed.value.trim();
  if (!text) {
    showError(AI_ERRORS.empty_text.message);
    return;
  }
  if (countCharacters(text) > AI_LIMITS.maxInputChars) {
    showError(AI_ERRORS.text_too_long.message);
    return;
  }
  errorEl.hidden = true;
  busy = true;
  sync();
  ctrl = new AbortController();
  const started = performance.now();
  processing.hidden = false;
  elapsed.textContent = '';
  const tick = window.setInterval(() => (elapsed.textContent = `${Math.floor((performance.now() - started) / 1000)}s`), 1000);
  const act = action();
  track('ai_processing_started', { action: act, size_bucket: sizeBucket(text.length) });

  try {
    const res = await fetch('/api/ai/rewrite', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ text, action: act, instruction: instruction.value.trim() || undefined }),
      signal: ctrl.signal,
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok || typeof body?.text !== 'string' || !body.text) {
      const code = body?.error?.code;
      const message = isAiErrorCode(code) ? AI_ERRORS[code].message : AI_ERRORS.ai_failed.message;
      if (code === 'ai_unavailable') {
        available = false;
        unavailable.hidden = false;
        quota.textContent = '';
      }
      track('ai_processing_failed', { action: act, code: isAiErrorCode(code) ? code : `http_${res.status}`, ms: performance.now() - started });
      showError(message);
      return;
    }
    resultText = body.text;
    origEl.textContent = text;
    resEl.textContent = resultText;
    output.hidden = false;
    showQuota(body.remainingToday);
    track('ai_processing_completed', { action: act, ms: performance.now() - started, output_bucket: sizeBucket(resultText.length) });
    announce('Rewrite ready. The result is next to your original.');
    resEl.focus({ preventScroll: true });
    resEl.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      announce('Rewrite stopped.');
      track('ai_processing_failed', { action: act, code: 'cancelled', ms: performance.now() - started });
    } else {
      track('ai_processing_failed', { action: act, code: 'network', ms: performance.now() - started });
      showError("We couldn't reach Texty. Check your connection and try again.");
    }
  } finally {
    clearInterval(tick);
    processing.hidden = true;
    busy = false;
    ctrl = null;
    sync();
  }
}

btn.addEventListener('click', rewrite);
againBtn.addEventListener('click', rewrite);
onPrimary(rewrite);
instruction.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    rewrite();
  }
});
cancelBtn.addEventListener('click', () => ctrl?.abort());
copyBtn.addEventListener('click', () => copyWithFeedback(copyBtn, resultText, 'Result'));
useBtn.addEventListener('click', () => {
  if (!resultText) return;
  ed.set(resultText);
  ed.focus();
  announce('The result is now in the text box. Choose another action to keep refining it.');
});
ed.onInput(sync);
sync();
checkStatus();
