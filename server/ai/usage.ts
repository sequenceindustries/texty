/**
 * Daily usage caps (per visitor and global) plus a bounded-concurrency gate.
 * In-memory per instance; move to Redis if running several replicas.
 * Visitor keys are never logged.
 */

const today = () => new Date().toISOString().slice(0, 10);

export class UsageMeter {
  private day = today();
  private perKey = new Map<string, number>();
  private global = 0;

  constructor(
    private readonly perKeyLimit: number,
    private readonly globalLimit: number,
  ) {}

  private roll() {
    const d = today();
    if (d !== this.day) {
      this.day = d;
      this.perKey.clear();
      this.global = 0;
    }
  }

  /** Reserve one use. Returns the reason when refused. */
  take(key: string): 'ok' | 'daily_limit' | 'busy' {
    this.roll();
    if (this.global >= this.globalLimit) return 'busy';
    const n = this.perKey.get(key) ?? 0;
    if (n >= this.perKeyLimit) return 'daily_limit';
    this.perKey.set(key, n + 1);
    this.global++;
    return 'ok';
  }

  /** Give a use back (the request failed before it could cost anything). */
  refund(key: string) {
    this.roll();
    const n = this.perKey.get(key) ?? 0;
    if (n > 0) this.perKey.set(key, n - 1);
    if (this.global > 0) this.global--;
  }

  remaining(key: string): number {
    this.roll();
    return Math.max(0, Math.min(this.perKeyLimit - (this.perKey.get(key) ?? 0), this.globalLimit - this.global));
  }

  get stats() {
    return { day: this.day, usedToday: this.global, visitorsToday: this.perKey.size };
  }
}

export class Gate {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(
    private readonly max: number,
    private readonly maxQueue: number,
  ) {}

  /** Runs fn when a slot is free. Rejects with 'busy' when the queue is full. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      if (this.queue.length >= this.maxQueue) throw new Error('busy');
      // The finishing request hands its slot straight to us (active is not decremented).
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else this.active++;
    try {
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }

  get stats() {
    return { active: this.active, queued: this.queue.length };
  }
}
