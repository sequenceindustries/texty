import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { AI_ERRORS, validateRewrite, type AiErrorCode } from '../shared/ai.js';
import { aiConfigFromEnv, createProvider, type AiConfig } from './ai/registry.js';
import { TextRewriteService } from './ai/rewrite.js';
import { ProviderError } from './ai/provider.js';
import { Gate, UsageMeter } from './ai/usage.js';

export interface AppOptions {
  /** Directory of the built static site. Omit to run API-only (tests). */
  staticDir?: string;
  logger?: boolean;
  /** AI settings; defaults come from the environment. */
  ai?: Partial<AiConfig>;
  /** Inject a rewrite service (tests). Defaults to one built from the configured provider. */
  rewriteService?: TextRewriteService;
  /** Extra origins allowed by the CSP, e.g. an ad or analytics network later. */
  cspExtra?: { script?: string[]; connect?: string[]; img?: string[]; frame?: string[] };
}

const EVENT_NAMES = new Set([
  'tool_view',
  'text_input',
  'tool_action',
  'copy_clicked',
  'download_clicked',
  'ai_processing_started',
  'ai_processing_completed',
  'ai_processing_failed',
]);
const EVENT_PROPS = new Set(['tool', 'action', 'option', 'code', 'ms', 'size_bucket', 'source', 'output_bucket']);

class ApiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
  }
}

function sendError(reply: FastifyReply, code: AiErrorCode) {
  const e = AI_ERRORS[code];
  return reply.status(e.status).header('Cache-Control', 'no-store').send({ error: { code, message: e.message } });
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const cfg: AiConfig = { ...aiConfigFromEnv(), ...opts.ai };
  const rewriter = opts.rewriteService ?? new TextRewriteService(createProvider(cfg));
  const usage = new UsageMeter(cfg.dailyPerIp, cfg.dailyGlobal);
  const aiGate = new Gate(cfg.maxConcurrent, cfg.maxQueue);

  const app = Fastify({
    trustProxy: true,
    bodyLimit: 64 * 1024,
    logger: opts.logger
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          // Never log client IPs or request bodies (user text).
          serializers: { req: (req) => ({ method: req.method, url: req.url }) },
        }
      : false,
  });

  const extra = opts.cspExtra ?? {};
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${(extra.script ?? []).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${(extra.img ?? []).join(' ')}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${(extra.connect ?? []).join(' ')}`.trim(),
    "worker-src 'self' blob:",
    `frame-src ${(extra.frame ?? []).length ? extra.frame!.join(' ') : "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    const type = String(reply.getHeader('content-type') ?? '');
    if (type.startsWith('text/html')) reply.header('Content-Security-Policy', csp);
    return payload;
  });

  await app.register(compress, { global: true, threshold: 1024, encodings: ['br', 'gzip'] });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({ statusCode: 429, error: { code: 'rate_limited', message: AI_ERRORS.rate_limited.message } }),
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) return sendError(reply, err.code);
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return sendError(reply, 'rate_limited');
    if (status === 413) return sendError(reply, 'text_too_long');
    if (status && status >= 400 && status < 500) return sendError(reply, 'invalid_request');
    req.log.error({ err: (err as Error).message }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  });

  // sendBeacon posts text/plain.
  app.addContentTypeParser('text/plain', { parseAs: 'string', bodyLimit: 4096 }, (_req, body, done) => done(null, body));

  app.get('/healthz', async () => ({ ok: true, ai: { available: rewriter.available, ...aiGate.stats, ...usage.stats } }));

  // Which AI tools can run right now, and how many free uses this visitor has left today.
  app.get('/api/ai/status', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { tools: { 'ai-text-rewriter': { available: rewriter.available, remainingToday: usage.remaining(req.ip) } } };
  });

  app.post(
    '/api/ai/rewrite',
    { config: { rateLimit: { max: cfg.ratePerMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new ApiError('invalid_request');
      const v = validateRewrite(req.body);
      if (!v.ok) throw new ApiError(v.code);
      if (!rewriter.available) throw new ApiError('ai_unavailable');

      const key = req.ip;
      const taken = usage.take(key);
      if (taken !== 'ok') throw new ApiError(taken);

      // Stop the provider call on timeout, or when the visitor goes away.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new Error('timeout')), cfg.timeoutSeconds * 1000);
      // Note: the request stream emits 'close' as soon as its body is read, so watch the response instead.
      const onClose = () => {
        if (!reply.raw.writableFinished) ctrl.abort(new Error('client closed'));
      };
      reply.raw.once('close', onClose);

      const started = performance.now();
      try {
        const result = await aiGate.run(() => rewriter.rewrite(v.value, ctrl.signal));
        const ms = Math.round(performance.now() - started);
        req.log.info(
          {
            evt: 'ai_usage',
            tool: 'ai-text-rewriter',
            action: v.value.action,
            custom: Boolean(v.value.instruction),
            provider: result.provider,
            model: result.model,
            ms,
            inChars: v.value.text.length,
            outChars: result.text.length,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: result.costUsd,
          },
          'ai rewrite',
        );
        reply.header('Cache-Control', 'no-store');
        return { text: result.text, ms, remainingToday: usage.remaining(key) };
      } catch (e) {
        let code: AiErrorCode = 'ai_failed';
        let billed = false;
        if (e instanceof Error && e.message === 'busy') code = 'busy';
        else if (e instanceof ProviderError) {
          billed = e.billed;
          code = e.kind === 'unavailable' ? 'ai_unavailable' : e.kind === 'busy' ? 'busy' : e.kind === 'timeout' ? 'ai_timeout' : 'ai_failed';
          req.log.warn({ evt: 'ai_failed', tool: 'ai-text-rewriter', kind: e.kind, detail: e.detail, ms: Math.round(performance.now() - started) }, 'ai failed');
        } else {
          req.log.error({ evt: 'ai_failed', tool: 'ai-text-rewriter', err: (e as Error).message }, 'ai failed');
        }
        // Give the use back unless the provider may have charged for it.
        if (!billed) usage.refund(key);
        throw new ApiError(code);
      } finally {
        clearTimeout(timer);
        reply.raw.off('close', onClose);
      }
    },
  );

  // First-party, cookie-free analytics. Only whitelisted, non-identifying
  // properties are accepted (never any user text); events go to the structured log.
  app.post('/api/events', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
    let body = req.body as unknown;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return reply.status(204).send();
      }
    }
    const b = body as { name?: unknown; props?: unknown } | null;
    if (!b || typeof b.name !== 'string' || !EVENT_NAMES.has(b.name)) return reply.status(204).send();
    const props: Record<string, string | number> = {};
    if (b.props && typeof b.props === 'object') {
      for (const [k, v] of Object.entries(b.props as Record<string, unknown>)) {
        if (!EVENT_PROPS.has(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) props[k] = Math.round(v);
        else if (typeof v === 'string') props[k] = v.slice(0, 40).replace(/[^\w.:-]/g, '');
      }
    }
    req.log.info({ evt: 'analytics', name: b.name, ...props }, 'event');
    return reply.status(204).send();
  });

  if (opts.staticDir) await registerSite(app, opts.staticDir);
  else app.setNotFoundHandler((_req, reply) => sendError(reply, 'not_found'));

  return app;
}

async function registerSite(app: FastifyInstance, dir: string) {
  const root = path.resolve(dir);
  await app.register(fastifyStatic, {
    root,
    index: false,
    redirect: false,
    // HTML is only reachable through the extensionless routes below.
    allowedPath: (p) => !p.endsWith('.html'),
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}_astro${path.sep}`)) res.header('Cache-Control', 'public, max-age=31536000, immutable');
      else res.header('Cache-Control', 'public, max-age=86400');
    },
  });

  const files: string[] = [];
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else files.push(path.relative(root, p).split(path.sep).join('/'));
    }
  };
  walk(root);

  // Pages are small: hold them in memory and serve without touching disk.
  const pages = new Map<string, Buffer>();
  for (const rel of files) {
    if (!rel.endsWith('.html')) continue;
    pages.set(rel, fs.readFileSync(path.join(root, rel)));
    if (rel === '404.html') continue;
    const route = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
    app.get(route, (_req, reply) =>
      reply.type('text/html; charset=utf-8').header('Cache-Control', 'public, max-age=0, must-revalidate').send(pages.get(rel)),
    );
    app.get('/' + rel, (_req, reply) => reply.redirect(route, 301));
  }

  app.setNotFoundHandler((req, reply) => {
    // Trailing-slash variants of real pages are permanently redirected.
    if (req.method === 'GET' && req.url.length > 1 && req.url.endsWith('/')) {
      const target = req.url.replace(/\/+$/, '');
      if (files.includes(target.slice(1) + '.html')) return reply.redirect(target, 301);
    }
    if (req.url.startsWith('/api/')) return sendError(reply, 'not_found');
    const notFound = pages.get('404.html');
    if (notFound) return reply.status(404).type('text/html; charset=utf-8').send(notFound);
    return reply.status(404).send('Not found');
  });
}
