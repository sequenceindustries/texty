# Texty

**Text tools that just work.** Free, account-free, mostly in-browser text utilities: Word Counter (flagship), Character Counter, Case Converter, Text Cleaner, Remove Duplicate Lines, Sort Lines, Find & Replace, Text Diff, URL Slug Generator, Lorem Ipsum Generator, Text Repeater, and the AI Text Rewriter.

Part of the Sequence Industries portfolio. Built on the same stack and deployment shape as ImageTools (Astro static pages + one Fastify service on Railway). See [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it

```bash
npm install
npm run build          # static site (dist/) + server (build/)
npm start              # http://localhost:8080
```

Development with live reload:

```bash
npm run dev:api        # API on :8080
npm run dev            # site on :4321, /api proxied to :8080
```

The AI Text Rewriter needs `ANTHROPIC_API_KEY` in the server environment. Without it, the tool says "AI rewriting is temporarily unavailable" and every other tool works normally.

## Test

```bash
npm test               # unit + API suites (vitest): every text tool, AI validation, provider failures, caps
npm run check          # type check (Astro + server)
```

Browser suite (Playwright for Python: `pip install playwright && playwright install chromium`):

```bash
PORT=8090 npm start &                                             # no AI key: tests graceful failure
python3 test/e2e/fake_anthropic.py 8099 &                         # stand-in for the Anthropic API
PORT=8091 ANTHROPIC_API_KEY=x ANTHROPIC_BASE_URL=http://127.0.0.1:8099 AI_TIMEOUT_SECONDS=3 npm start &
python3 test/e2e/run.py http://127.0.0.1:8090 http://127.0.0.1:8091
```

It loads every page at phone and desktop sizes (console errors, horizontal overflow, axe accessibility, unique SEO metadata, FAQ schema), exercises every tool (copy, download, keyboard, large inputs, a catastrophic regex, 20k-line diff, AI success/timeout/unavailable), and checks dark mode and reduced motion. Screenshots land in `test/e2e/out/`.

## Deploy (Railway)

The repo deploys as a single Docker service (`Dockerfile`, `railway.json`).

1. Create a Railway service from this GitHub repo.
2. Set `SITE_URL` to the public origin (e.g. `https://texty.app`). It is baked into canonical URLs, Open Graph tags and the sitemap at build time.
3. Set `ANTHROPIC_API_KEY` to enable the AI Text Rewriter. Model defaults to `claude-haiku-4-5` (`ANTHROPIC_MODEL`).
4. 512 MB RAM is plenty: the server only serves static pages and proxies small AI requests.
5. Health check: `GET /healthz`.

All optional variables, including the AI cost caps, are in `.env.example`.

## Adding a tool

1. Pure logic in `shared/text/` with tests in `test/text.test.ts`.
2. An entry in `src/data/tools.ts` (slug, group, SEO copy, how-to, FAQs, related tools).
3. A component in `src/components/tools/` built from the shared pieces (`TextEditor`, `ResultPanel`, …) and a script in `src/scripts/tools/`.
4. Map the slug to the component in `src/pages/[tool].astro`.

Routing, sitemap, navigation, footer, cards, related links and structured data come from the registry.

Adding an AI tool: a service next to `server/ai/rewrite.ts` that talks only to the `AIProvider` interface, a route in `server/app.ts`, and its contract in `shared/ai.ts`.

## Images

`python3 scripts/make-images.py` regenerates the favicon PNGs and `og.png` from `public/favicon.svg` and the real web font.
