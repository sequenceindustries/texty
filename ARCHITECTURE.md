# Texty architecture

## Starting point

There was no Texty repository. The closest sibling, **ImageTools** (`sequenceindustries/imagetools`), was inspected first and its proven infrastructure was lifted rather than reinvented, without its branding:

| Reused from ImageTools | Changed for Texty |
|---|---|
| Astro static pages + one Fastify service, Dockerfile, `railway.json`, `/healthz` | No image deps (sharp, ONNX or models), so the image is far smaller |
| Security headers, strict CSP (`script-src 'self'`), compression, page serving, trailing-slash redirects | Adds `worker-src 'self'` for the compute worker |
| Cookie-free `/api/events` analytics with a property whitelist; optional Plausible | Texty event names; props never include text |
| Registry-driven pages (`src/data/tools.ts` → `[tool].astro` → sitemap / nav / JSON-LD) | — |
| `AdSlot` (off until `PUBLIC_ADS_ENABLED=true`, never inside the tool area) | — |
| AI provider interface + registry, per-visitor/global daily caps, burst rate limit, timeouts, usage logs | Text in/out instead of images; Anthropic via plain `fetch` |

Nothing is imported across repos: ImageTools' ARCHITECTURE says "extract a shared package when TextTools needs the same pieces". Texty now does, so the obvious next step is a small `@sequence/web-kit` (server scaffolding, analytics, AdSlot, Base SEO head) once a third product confirms the shape.

## Shape

```
Browser                                         Node service (Fastify)
──────────────────────────────────              ─────────────────────────────────────
Static pages (Astro, prebuilt)        ──GET──▶  served from memory / dist
Tool scripts (2–5 KB each, gz ~1–2 KB)
  └ shared/text/*  (all non-AI logic)            (no user text ever reaches the server)
  └ Web Worker: regex + diff, time-limited
AI rewriter                           ──POST──▶ /api/ai/rewrite  validate → caps → gate → TextRewriteService → AIProvider
Analytics (sendBeacon)                ──POST──▶ /api/events      whitelisted names/props → structured log
```

### Text engine (`shared/text/`)

Pure functions, no DOM, unit-tested (63 tests): `stats` (words, grapheme-correct characters, sentences, paragraphs, reading/speaking time, frequency, GSM-03.38 SMS segments), `case`, `clean`, `lines` (dedupe, natural/numeric/length sort, crypto shuffle), `find` (literal or regex, Unicode whole-word, friendly regex errors), `diff` (Myers line diff with prefix/suffix trimming, O(D²) memory, word-level inline diff for changed lines, graceful fallback past 3,000 edits), `generate` (slug, lorem, repeat with exact size prediction).

### Large-text protection

- Editors accept up to 5M characters and warn above 500k.
- Stats and live transforms run on the next frame, or debounced (180–400 ms) for very large text.
- Results go into a read-only `<textarea>` (no huge DOM); output over 1M characters is previewed, with copy/download using the full text.
- User regexes and diffs run in a **Web Worker** with a hard time limit; a runaway pattern (e.g. `(a+)+$`) is stopped by terminating the worker. Newer input cancels older jobs.
- Diff renders at most 3,000 rows, folds unchanged runs, and caps inputs at 50k lines.
- Repeater refuses output over 10M characters and requires confirmation above 1M.

### AI layer

```
AIProvider (server/ai/provider.ts)         interface: complete({system, prompt, maxTokens, stop, signal})
  ├─ AnthropicProvider (anthropic.ts)      Messages API via fetch; key only in server env, only sent to the API
  └─ NoProvider                            unconfigured → "unavailable", never fakes output
createProvider (registry.ts)               AI_PROVIDER selects; add a vendor = one class + one case
TextRewriteService (rewrite.ts)            prompt, token budget, <rewrite> extraction, cost estimate
POST /api/ai/rewrite (app.ts)              strict validation (shared/ai.ts), burst limit, daily per-visitor + global caps,
                                           concurrency gate + queue, timeout, abort on client disconnect
```

- **Prompt-injection hygiene:** user text is wrapped in tags (and our tags are escaped inside it); the system prompt says the text is material, not instructions; the custom instruction is only honoured for style/tone/length.
- **Failure mapping:** 401/403 → unavailable; 429/529 → busy; network/5xx → failed; abort → timeout; empty/garbage/truncated output → failed. Users see plain-English copy from `shared/ai.ts`; vendor bodies go only to logs.
- **Cost control:** credits are refunded when the provider couldn't have billed. Every success logs `evt: ai_usage` with action, model, ms, char counts, tokens and estimated USD. No text is logged.

### Analytics

| Question | Events |
|---|---|
| Traffic per tool / source | `tool_view{tool, source}` |
| Did people actually use it | `text_input{tool, size_bucket}` (once per view) |
| Which options matter | `tool_action{tool, action/option}` |
| Value delivered | `copy_clicked`, `download_clicked` |
| AI health and cost | `ai_processing_started/completed/failed{action, code, ms}` + server `ai_usage` |

### Front end

Static HTML per page; only the current tool's script ships. Design: the exercise-book page — the editor is ruled paper with a red margin line; one family (Recursive, Casual axis for headings, Linear for reading); navy ink, one ink-blue action colour, highlighter-yellow selection; full dark mode; reduced motion respected. The diff never relies on colour alone (+ / − / ~ markers, strikethrough/underline, screen-reader labels).

## Known limits / next steps

- Rate limits and AI caps are in-memory per instance; use Redis if scaling to several replicas.
- Analytics go to logs; add a log drain or set `PUBLIC_PLAUSIBLE_DOMAIN` for dashboards.
- Character-limit table (`src/data/limits.ts`) should be reviewed periodically; the page shows its review date.
- Ads: choose a network, set `PUBLIC_ADS_ENABLED=true`, extend CSP via `CSP_*`, and add a consent banner where required.
