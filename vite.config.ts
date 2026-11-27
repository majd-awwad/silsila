/// <reference types="vitest/config" />
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** the largest body any endpoint accepts (speech-to-text audio), with room to spare; each endpoint has its own cap */
const MAX_BODY = 3_000_000;

/** The request body, or null when it is too large. The rest is drained so the client receives the answer. */
async function bodyOf(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size <= MAX_BODY) chunks.push(chunk as Buffer);
  }
  return size <= MAX_BODY ? Buffer.concat(chunks) : null;
}

function answer(res: ServerResponse, status: number, error: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  if (status === 405) res.setHeader('allow', 'POST');
  res.end(JSON.stringify({ error }));
}

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
        const name = req.url.slice(5).split('?')[0];
        try {
          // names starting with _ are helpers, not endpoints
          if (!/^[a-z][a-z-]*$/.test(name) || !existsSync(join(server.config.root, 'api', `${name}.ts`))) return answer(res, 404, 'not_found');
          if (req.method !== 'POST') return answer(res, 405, 'method_not_allowed');
          const body = await bodyOf(req);
          if (!body) return answer(res, 413, 'bad_request');
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          if (typeof mod.POST !== 'function') return answer(res, 405, 'method_not_allowed');
          // only these headers go through: the client's address comes from the socket, never from the client
          const headers = new Headers({ 'x-silsila-ip': req.socket.remoteAddress ?? 'local' });
          if (req.headers['content-type']) headers.set('content-type', req.headers['content-type']);
          const request = new Request(`http://localhost${req.url}`, { method: 'POST', headers, body: new Uint8Array(body) });
          const response: Response = await mod.POST(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          // bytes, not text: Noor's voice is binary audio and text decoding corrupts it
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(`[api/${name}] ${e instanceof Error ? e.message : 'failed'}`);
          answer(res, 500, 'dev_api_failed');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env.local values (OPENROUTER_API_KEY) visible to the dev API handlers. Vite restarts when .env.local
  // changes, but loadEnv lets values already in process.env win, so drop the ones we set last time first.
  for (const key of (process.env.SILSILA_ENV_KEYS ?? '').split(',')) if (key) delete process.env[key];
  const shell = new Set(Object.keys(process.env));
  const env = loadEnv(mode, process.cwd(), '');
  // tests never see a developer's real key or database
  if (mode !== 'test') {
    Object.assign(process.env, env);
    process.env.SILSILA_ENV_KEYS = Object.keys(env).filter((k) => !shell.has(k)).join(',');
  }
  return {
    plugins: [react(), tailwindcss(), devApi()],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
