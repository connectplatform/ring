/**
 * Tunnel Initialization After Authentication
 * PHASE 1: Implements delayed tunnel establishment for auth-critical routes
 */

import { getTunnelTransportManager } from './transport-manager';

/**
 * Initialize tunnel after user authentication is confirmed
 * Called from ProfileWrapper after auth verification
 */
export async function initializeTunnelAfterAuth(): Promise<void> {
  console.log('TunnelInit: Initializing tunnel after auth confirmation');

  try {
    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development'
    });

    // Establish connection
    await manager.connect();

    console.log('TunnelInit: Tunnel successfully established after auth');

    // Mark tunnel as ready globally
    if (typeof window !== 'undefined') {
      (window as any).__TUNNEL_READY__ = true;
    }

  } catch (error) {
    console.error('TunnelInit: Failed to initialize tunnel after auth:', error);

    // Graceful degradation - continue without tunnel
    if (typeof window !== 'undefined') {
      (window as any).__TUNNEL_READY__ = false;
    }

    throw error;
  }
}

/**
 * Check if tunnel is ready
 */
export function isTunnelReady(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).__TUNNEL_READY__ === true;
}

/**
 * Wait for tunnel to be ready with timeout
 */
export async function waitForTunnel(timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isTunnelReady()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();

    const checkTunnel = () => {
      if (isTunnelReady()) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeout) {
        console.warn('TunnelInit: Timeout waiting for tunnel to be ready');
        resolve(false);
        return;
      }

      // Check again in 100ms
      setTimeout(checkTunnel, 100);
    };

    checkTunnel();
  });
}
