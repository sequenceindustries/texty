import { defineConfig } from 'astro/config';

// SITE_URL is the public origin used for canonical URLs, sitemap and OG tags.
const site = process.env.SITE_URL ?? 'http://localhost:8080';

export default defineConfig({
  site,
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  compressHTML: true,
  server: { port: 4321 },
  // Scripts stay external so the CSP can be script-src 'self'.
  // In dev, the Astro server forwards API calls to the Fastify server (npm run dev:api).
  vite: {
    build: { assetsInlineLimit: 0 },
    worker: { format: 'es' },
    server: { proxy: { '/api': 'http://localhost:8080' } },
  },
});
