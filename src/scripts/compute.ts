/**
 * Runs heavy work in a Web Worker with a time limit. A runaway job (for
 * example a regular expression with catastrophic backtracking) is stopped by
 * terminating the worker, so the page never freezes.
 */
import type { ComputeRequest } from '../workers/compute';

export type ComputeResponse = { ok: true; [k: string]: unknown } | { ok: false; error: string };

export class TimeoutError extends Error {}
export class CancelledError extends Error {}

let worker: Worker | null = null;
let seq = 0;
let pending: { id: number; reject: (e: Error) => void; timer: number } | null = null;

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/compute.ts', import.meta.url), { type: 'module' });
  return worker;
}

function kill() {
  worker?.terminate();
  worker = null;
}

/**
 * Start a job. Any job still running is cancelled first (the latest input wins).
 */
export function compute<T extends ComputeResponse>(req: ComputeRequest, timeoutMs: number): Promise<T> {
  if (pending) {
    clearTimeout(pending.timer);
    pending.reject(new CancelledError());
    pending = null;
    kill();
  }
  const id = ++seq;
  const w = getWorker();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (pending?.id !== id) return;
      pending = null;
      kill();
      reject(new TimeoutError());
    }, timeoutMs);
    pending = { id, reject, timer };
    const onMessage = (e: MessageEvent<{ id: number } & ComputeResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMessage);
      clearTimeout(timer);
      if (pending?.id === id) pending = null;
      resolve(e.data as unknown as T);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        if (pending?.id === id) pending = null;
        kill();
        reject(new Error('worker error'));
      },
      { once: true },
    );
    w.postMessage({ id, req });
  });
}
