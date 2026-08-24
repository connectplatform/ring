/**
 * Unified custom server — Next.js request handler + optional native WSS tunnel.
 * Entrypoint for dev and k8s/self-hosted production (not used on Vercel serverless).
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { Duplex } from 'node:stream';
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
// Next internals should not use HOSTNAME=0.0.0.0 (k8s listen-all); keep bind separate.
const listenHost = process.env.HOSTNAME ?? '0.0.0.0';
const nextHostname =
  !listenHost || listenHost === '0.0.0.0' || listenHost === '::'
    ? 'localhost'
    : listenHost;
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname: nextHostname, port });
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

/**
 * Next lazily registers its HMR upgrade listener on the first HTTP request.
 * Keep that listener intact so /_next/webpack-hmr can finish its handshake, while
 * shielding the tunnel endpoint from it after the native WSS takes ownership.
 */
function preserveNextUpgradeListener(
  httpServer: Server,
  protectedPath: string,
): void {
  const originalOn = httpServer.on.bind(httpServer);
  httpServer.on = ((event: string | symbol, listener: (...args: unknown[]) => void) => {
    if (event === 'upgrade') {
      return originalOn('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const pathname = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
          .pathname;
        if (pathname !== protectedPath) {
          listener(req, socket, head);
        }
      });
    }
    return originalOn(event, listener as never);
  }) as Server['on'];
}

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
  const tunnelPath = '/api/tunnel/ws';
  attachTunnelWss(server, {
    path: tunnelPath,
    hub,
  });
  preserveNextUpgradeListener(server, tunnelPath);

  console.log(`[server] Native WSS attached at ${tunnelPath} (RING_DEPLOY_TARGET=${deployTarget})`);
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

server.listen(port, listenHost === 'localhost' ? undefined : listenHost, () => {
  console.log(`> Ready on http://${listenHost}:${port} [${deployTarget}]`);
});
