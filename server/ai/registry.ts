import { AnthropicProvider } from './anthropic.js';
import { NoProvider, type AIProvider } from './provider.js';

export interface AiConfig {
  provider: string;
  anthropicKey?: string;
  /** Optional: an API gateway in front of Anthropic. */
  anthropicBaseUrl?: string;
  anthropicModel: string;
  inputPerMTok: number;
  outputPerMTok: number;
  ratePerMinute: number;
  dailyPerIp: number;
  dailyGlobal: number;
  maxConcurrent: number;
  maxQueue: number;
  timeoutSeconds: number;
}

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};

export function aiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    provider: (env.AI_PROVIDER || 'anthropic').toLowerCase(),
    anthropicKey: env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL || undefined,
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    inputPerMTok: num(env.AI_PRICE_INPUT_PER_MTOK_USD, 1),
    outputPerMTok: num(env.AI_PRICE_OUTPUT_PER_MTOK_USD, 5),
    ratePerMinute: num(env.AI_RATE_LIMIT_PER_MINUTE, 6),
    dailyPerIp: num(env.AI_DAILY_PER_IP, 40),
    dailyGlobal: num(env.AI_DAILY_GLOBAL, 5000),
    maxConcurrent: Math.max(1, num(env.AI_MAX_CONCURRENT, 8)),
    maxQueue: num(env.AI_MAX_QUEUE, 32),
    timeoutSeconds: Math.max(1, num(env.AI_TIMEOUT_SECONDS, 30)),
  };
}

/**
 * Pick the provider. Adding a vendor = implementing AIProvider and adding a case here.
 * An unknown or unconfigured provider yields NoProvider, so AI tools report "unavailable".
 */
export function createProvider(c: AiConfig): AIProvider {
  switch (c.provider) {
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: c.anthropicKey,
        baseUrl: c.anthropicBaseUrl,
        model: c.anthropicModel,
        pricing: { inputPerMTok: c.inputPerMTok, outputPerMTok: c.outputPerMTok },
      });
    default:
      return new NoProvider();
  }
}
