/**
 * Unified custom server — Next.js request handler + optional native WSS tunnel.
 * Entrypoint for dev and k8s/self-hosted production (not used on Vercel serverless).
 */

import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { getDeployTarget } from './lib/tunnel/deploy-target';
import { getTunnelHub } from './lib/tunnel/hub';
import { attachTunnelWss } from './lib/tunnel/native-ws/attach';

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

if (deployTarget !== 'vercel') {
  attachTunnelWss(server, {
    path: '/api/tunnel/ws',
    hub: getTunnelHub(),
  });
  console.log(`[server] Native WSS attached at /api/tunnel/ws (RING_DEPLOY_TARGET=${deployTarget})`);
} else {
  console.log('[server] SSE-only mode (RING_DEPLOY_TARGET=vercel)');
}

server.listen(port, () => {
  console.log(`> Ready on http://${hostname}:${port} [${deployTarget}]`);
});
