/// <reference lib="webworker" />
/**
 * Off-main-thread work for operations that can be slow or unbounded:
 * user regular expressions (catastrophic backtracking) and large diffs.
 * The page terminates this worker if it runs past its time limit.
 */
import { buildPattern, countMatches, replaceText, type FindOptions } from '../../shared/text/find';
import { diffTexts, type DiffOptions } from '../../shared/text/diff';

export type ComputeRequest =
  | { op: 'count'; text: string; find: Omit<FindOptions, 'replace'> }
  | { op: 'replace'; text: string; find: FindOptions; mode: 'first' | 'all' }
  | { op: 'diff'; a: string; b: string; options: DiffOptions };

self.onmessage = (e: MessageEvent<{ id: number; req: ComputeRequest }>) => {
  const { id, req } = e.data;
  try {
    if (req.op === 'count') {
      const p = buildPattern(req.find);
      if (!p.ok) return postMessage({ id, ok: false, error: p.error });
      return postMessage({ id, ok: true, count: countMatches(req.text, p.re) });
    }
    if (req.op === 'replace') {
      const r = replaceText(req.text, req.find, req.mode);
      if ('error' in r) return postMessage({ id, ok: false, error: r.error });
      return postMessage({ id, ok: true, text: r.text, replaced: r.replaced });
    }
    if (req.op === 'diff') return postMessage({ id, ok: true, diff: diffTexts(req.a, req.b, req.options) });
  } catch (err) {
    postMessage({ id, ok: false, error: 'failed' });
  }
};
