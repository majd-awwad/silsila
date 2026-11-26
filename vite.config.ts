/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * In development, serve /api/* from the same files Vercel deploys (api/*.ts),
 * so `npm run dev` is the whole app: no `vercel dev` needed.
 * Each api file exports `POST(request: Request): Promise<Response>`.
 */
function devApi(): Plugin {
  return {
    name: 'silsila-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const name = req.url.slice(5).split('?')[0].replace(/[^a-z-]/g, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          if (req.method !== 'POST' || typeof mod.POST !== 'function') {
            res.statusCode = 405;
            res.end('method not allowed');
            return;
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(`http://localhost${req.url}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.concat(chunks).toString('utf8'),
          });
          const response: Response = await mod.POST(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'dev_api_failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env.local values (OPENROUTER_API_KEY) visible to the dev API handlers.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss(), devApi()],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
