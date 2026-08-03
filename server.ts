/**
 * Unified custom server — Next.js request handler + optional native WSS tunnel.
 * Entrypoint for dev and k8s/self-hosted production (not used on Vercel serverless).
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { parse } from 'node:url';
import next from 'next';
import { getDeployTarget } from './lib/tunnel/deploy-target';
import { getTunnelHub, isTunnelHubLifecycle } from './lib/tunnel/hub';
import { attachTunnelWss } from './lib/tunnel/native-ws/attach';

// @next/env is CJS-only. Named ESM import `{ loadEnvConfig }` fails under
// `node --import tsx` (Node 25 + Next 16). createRequire is the stable interop.
const { loadEnvConfig } = createRequire(import.meta.url)('@next/env') as typeof import('@next/env');

// Load .env* before reading PORT — otherwise `PORT=` in .env.local is ignored and
// the server binds :3000 while NEXT_PUBLIC_* still point at another port.
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url ?? '/', true);
    await handle(req, res, parsedUrl);
  } catch (error) {
    console.error('Request handler error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

const deployTarget = getDeployTarget();
const hub = getTunnelHub();

if (isTunnelHubLifecycle(hub)) {
  try {
    await hub.startFanout();
    console.log('[server] Postgres tunnel fan-out LISTEN started');
  } catch (error) {
    console.error(
      '[server] Postgres tunnel fan-out failed to start (continuing with local hub):',
      error instanceof Error ? error.message : error,
    );
  }
}

if (deployTarget !== 'vercel') {
  attachTunnelWss(server, {
    path: '/api/tunnel/ws',
    hub,
  });
  console.log(`[server] Native WSS attached at /api/tunnel/ws (RING_DEPLOY_TARGET=${deployTarget})`);
} else {
  console.log('[server] SSE-only mode (RING_DEPLOY_TARGET=vercel)');
}

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} — shutting down`);
  if (isTunnelHubLifecycle(hub)) {
    try {
      await hub.stopFanout();
    } catch (error) {
      console.error(
        '[server] stopFanout error:',
        error instanceof Error ? error.message : error,
      );
    }
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

server.listen(port, () => {
  console.log(`> Ready on http://${hostname}:${port} [${deployTarget}]`);
});
