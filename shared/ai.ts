/**
 * Contract shared by the AI tools' browser code and the server, so limits,
 * actions and error copy cannot drift apart.
 */

export const REWRITE_ACTIONS = [
  { id: 'rewrite', label: 'Rewrite', hint: 'Same meaning, fresh wording' },
  { id: 'shorter', label: 'Make shorter', hint: 'Tighter, same key points' },
  { id: 'longer', label: 'Make longer', hint: 'More detail and depth' },
  { id: 'simplify', label: 'Simplify', hint: 'Plain, easy words' },
  { id: 'professional', label: 'Make professional', hint: 'Polished and clear' },
  { id: 'casual', label: 'Make casual', hint: 'Relaxed and friendly' },
] as const;

export type RewriteAction = (typeof REWRITE_ACTIONS)[number]['id'];

export const AI_LIMITS = {
  /** Characters of input text per request. */
  maxInputChars: 6000,
  /** Characters in the optional custom instruction. */
  maxInstructionChars: 200,
  /** A result longer than this is treated as a failure rather than shown. */
  maxOutputChars: 24_000,
} as const;

export interface RewriteRequest {
  text: string;
  action: RewriteAction;
  instruction?: string;
}

export type ValidationResult = { ok: true; value: RewriteRequest } | { ok: false; code: AiErrorCode };

export function isRewriteAction(v: unknown): v is RewriteAction {
  return typeof v === 'string' && REWRITE_ACTIONS.some((a) => a.id === v);
}

/** Strict request validation: unknown fields, wrong types and oversized values are rejected. */
export function validateRewrite(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'invalid_request' };
  const b = body as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!['text', 'action', 'instruction'].includes(k)) return { ok: false, code: 'invalid_request' };
  if (typeof b.text !== 'string' || !isRewriteAction(b.action)) return { ok: false, code: 'invalid_request' };
  if (b.instruction !== undefined && typeof b.instruction !== 'string') return { ok: false, code: 'invalid_request' };
  const text = b.text.trim();
  if (!text) return { ok: false, code: 'empty_text' };
  if ([...text].length > AI_LIMITS.maxInputChars) return { ok: false, code: 'text_too_long' };
  const instruction = (b.instruction ?? '').trim();
  if ([...instruction].length > AI_LIMITS.maxInstructionChars) return { ok: false, code: 'instruction_too_long' };
  return { ok: true, value: { text, action: b.action, instruction: instruction || undefined } };
}

export const AI_ERRORS = {
  invalid_request: { status: 400, message: 'Something about that request was not right. Please refresh the page and try again.' },
  empty_text: { status: 400, message: 'Paste or type some text to rewrite first.' },
  text_too_long: { status: 400, message: `That text is too long to rewrite in one go. Please keep it under ${AI_LIMITS.maxInputChars.toLocaleString('en')} characters.` },
  instruction_too_long: { status: 400, message: `Please keep the instruction under ${AI_LIMITS.maxInstructionChars} characters.` },
  rate_limited: { status: 429, message: "You're going a little fast. Please wait a minute and try again." },
  daily_limit: { status: 429, message: "You've reached today's free AI rewrites. Come back tomorrow for more." },
  busy: { status: 503, message: 'AI rewriting is busy right now. Please try again in a moment.' },
  ai_unavailable: { status: 503, message: 'AI rewriting is temporarily unavailable.' },
  ai_timeout: { status: 504, message: "That took too long, so we stopped it. Please try again, or try a shorter piece of text." },
  ai_failed: { status: 502, message: "We couldn't rewrite this text right now. Please try again." },
  not_found: { status: 404, message: 'Not found.' },
} as const;

export type AiErrorCode = keyof typeof AI_ERRORS;

export function isAiErrorCode(v: unknown): v is AiErrorCode {
  return typeof v === 'string' && v in AI_ERRORS;
}
