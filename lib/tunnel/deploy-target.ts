/**
 * Deployment target — selects tunnel transport profile.
 * vercel: SSE + poll only (serverless / Edge)
 * k8s | self-hosted: native WSS primary + SSE/poll fallback
 */

import { TunnelProvider } from './types';

export type RingDeployTarget = 'vercel' | 'k8s' | 'self-hosted';

const VALID_TARGETS: RingDeployTarget[] = ['vercel', 'k8s', 'self-hosted'];

export function getDeployTarget(): RingDeployTarget {
  const raw = (process.env.NEXT_PUBLIC_RING_DEPLOY_TARGET ??
    process.env.RING_DEPLOY_TARGET) as RingDeployTarget | undefined;

  if (!raw) {
    if (process.env.VERCEL === '1') return 'vercel';
    if (process.env.NODE_ENV === 'development') return 'self-hosted';
    throw new Error(
      'RING_DEPLOY_TARGET is required (vercel | k8s | self-hosted). Example: RING_DEPLOY_TARGET=k8s',
    );
  }

  if (!VALID_TARGETS.includes(raw)) {
    throw new Error(`Invalid RING_DEPLOY_TARGET: ${raw}. Must be one of: ${VALID_TARGETS.join(', ')}`);
  }

  return raw;
}

export function isNativeWssEnabled(): boolean {
  return getDeployTarget() !== 'vercel';
}

export function getPrimaryTransport(): TunnelProvider {
  return getDeployTarget() === 'vercel' ? TunnelProvider.SSE : TunnelProvider.WEBSOCKET;
}

export function getDeployFallbackChain(): TunnelProvider[] {
  const target = getDeployTarget();
  if (target === 'vercel') {
    return [TunnelProvider.SSE, TunnelProvider.LONG_POLLING];
  }
  return [TunnelProvider.WEBSOCKET, TunnelProvider.SSE, TunnelProvider.LONG_POLLING];
}
