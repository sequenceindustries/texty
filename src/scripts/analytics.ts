/**
 * First-party, cookie-free analytics.
 * Events go to /api/events (structured server logs) and, if configured, to
 * Plausible. Never any user text: only tool ids, actions, codes and coarse sizes.
 */

type Props = Record<string, string | number | undefined>;

let source: string | null = null;

/** Coarse traffic source: search, social, internal, other or direct. */
export function trafficSource(): string {
  if (source) return source;
  const ref = document.referrer;
  if (!ref) return (source = 'direct');
  try {
    const host = new URL(ref).hostname;
    if (host === location.hostname) source = 'internal';
    else if (/google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|baidu\.|ecosia\.|brave\./.test(host)) source = 'search';
    else if (/facebook\.|instagram\.|t\.co$|twitter\.|x\.com|reddit\.|linkedin\.|pinterest\.|tiktok\./.test(host)) source = 'social';
    else source = 'other';
  } catch {
    source = 'other';
  }
  return source;
}

/** Text length as a coarse bucket, never the text itself. */
export function sizeBucket(chars: number): string {
  if (chars < 1_000) return 'under-1k';
  if (chars < 10_000) return '1k-10k';
  if (chars < 100_000) return '10k-100k';
  if (chars < 1_000_000) return '100k-1M';
  return '1M-plus';
}

declare global {
  interface Window {
    plausible?: (name: string, opts?: { props?: Props }) => void;
    __txEvents?: Array<{ name: string; props: Props }>;
  }
}

export function currentTool(): string {
  return document.body.dataset.tool ?? 'home';
}

export function track(name: string, props: Props = {}) {
  const clean: Props = { tool: currentTool() };
  for (const [k, v] of Object.entries(props)) if (v !== undefined) clean[k] = v;
  (window.__txEvents ??= []).push({ name, props: clean });
  try {
    const body = JSON.stringify({ name, props: clean });
    if (!navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'text/plain' }))) {
      fetch('/api/events', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
    }
  } catch {
    /* analytics must never break the tool */
  }
  try {
    window.plausible?.(name, { props: clean });
  } catch {
    /* ignore */
  }
}

let inputTracked = false;
/** Once per page view: the visitor put text in. */
export function trackInput(chars: number) {
  if (inputTracked || chars === 0) return;
  inputTracked = true;
  track('text_input', { size_bucket: sizeBucket(chars) });
}
