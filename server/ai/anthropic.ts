import { ProviderError, type AIProvider, type CompletionRequest, type CompletionResult } from './provider.js';

export interface AnthropicOptions {
  apiKey: string | undefined;
  model: string;
  /** Overridable for tests. */
  baseUrl?: string;
  pricing?: { inputPerMTok: number; outputPerMTok: number };
}

/**
 * Anthropic Messages API over plain fetch (no SDK: one small request shape,
 * zero extra dependencies). The API key is sent only to the Anthropic API.
 */
export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly model: string;
  readonly pricing: { inputPerMTok: number; outputPerMTok: number };
  private readonly apiKey: string | undefined;
  private readonly url: string;

  constructor(o: AnthropicOptions) {
    this.apiKey = o.apiKey?.trim() || undefined;
    this.model = o.model;
    this.url = (o.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';
    this.pricing = o.pricing ?? { inputPerMTok: 1, outputPerMTok: 5 };
  }

  available(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) throw new ProviderError('unavailable', 'ANTHROPIC_API_KEY not set');
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        signal: req.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
          ...(req.stop?.length ? { stop_sequences: req.stop } : {}),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        }),
      });
    } catch (e) {
      if (req.signal?.aborted || (e as Error).name === 'AbortError' || (e as Error).name === 'TimeoutError')
        throw new ProviderError('timeout');
      throw new ProviderError('failed', 'network: ' + (e as Error).message);
    }

    if (!res.ok) {
      // Read the body for logs; never forward it to the browser.
      const body = await res.text().catch(() => '');
      const detail = `HTTP ${res.status} ${body.slice(0, 300)}`;
      if (res.status === 401 || res.status === 403) throw new ProviderError('unavailable', detail);
      if (res.status === 429 || res.status === 529) throw new ProviderError('busy', detail);
      throw new ProviderError('failed', detail);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (e) {
      if (req.signal?.aborted) throw new ProviderError('timeout');
      throw new ProviderError('bad_response', 'invalid JSON', true);
    }
    const d = data as {
      content?: { type?: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (!Array.isArray(d.content)) throw new ProviderError('bad_response', 'no content array', true);
    const text = d.content
      .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('');
    const finish =
      d.stop_reason === 'end_turn' ? 'end' : d.stop_reason === 'stop_sequence' ? 'stop' : d.stop_reason === 'max_tokens' ? 'length' : 'other';
    return {
      text,
      finish,
      usage: { inputTokens: Number(d.usage?.input_tokens) || 0, outputTokens: Number(d.usage?.output_tokens) || 0 },
    };
  }
}
