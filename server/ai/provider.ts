/**
 * The AI provider seam. Services (e.g. TextRewriteService) talk only to this
 * interface; vendors are plugged in through registry.ts.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Generation stops when the model emits one of these. */
  stop?: string[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  /** Normalised reason: finished naturally / hit a stop sequence / ran out of tokens / other. */
  finish: 'end' | 'stop' | 'length' | 'other';
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  /** Stable id for logs, e.g. "anthropic". */
  readonly id: string;
  readonly model: string;
  /** Configured and able to take requests (e.g. API key present). */
  available(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  /** USD per million input/output tokens, for cost estimates in logs. */
  readonly pricing: { inputPerMTok: number; outputPerMTok: number };
}

export type ProviderErrorKind =
  /** Not configured, or the vendor rejected our credentials. */
  | 'unavailable'
  /** The vendor is rate-limiting or overloaded. */
  | 'busy'
  | 'timeout'
  /** The vendor answered, but not with something we can use. */
  | 'bad_response'
  | 'failed';

export class ProviderError extends Error {
  constructor(
    public kind: ProviderErrorKind,
    public detail?: string,
    /** True when the vendor may have billed for the call. */
    public billed = false,
  ) {
    super(`${kind}${detail ? ': ' + detail : ''}`);
  }
}

/** Used when no provider is configured: always unavailable, never pretends. */
export class NoProvider implements AIProvider {
  readonly id = 'none';
  readonly model = 'none';
  readonly pricing = { inputPerMTok: 0, outputPerMTok: 0 };
  available() {
    return false;
  }
  async complete(): Promise<CompletionResult> {
    throw new ProviderError('unavailable', 'no AI provider configured');
  }
}
