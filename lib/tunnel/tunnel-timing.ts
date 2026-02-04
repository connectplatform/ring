/**
 * Tunnel Connection Timing Strategy Manager
 * Implements progressive tunnel connection strategies for optimal user experience
 *
 * Strategies:
 * 1. Delayed Auto-Connect: Connect 500ms after auth/page load
 * 2. Manual Connect: Require explicit user action
 * 3. Progressive Connect: Immediate for desktop, delayed for mobile
 */

import { getTunnelTransportManager } from './transport-manager';
import { TunnelProvider } from './types';

export enum TunnelTimingStrategy {
  DELAYED_AUTO = 'delayed_auto',     // 500ms after auth/page load
  MANUAL_ONLY = 'manual_only',       // Require explicit user action
  PROGRESSIVE = 'progressive'        // Immediate desktop, delayed mobile
}

export interface TunnelTimingConfig {
  strategy: TunnelTimingStrategy;
  delayedAutoDelay?: number;         // Default: 500ms
  progressiveDesktopDelay?: number;  // Default: 0ms (immediate)
  progressiveMobileDelay?: number;   // Default: 1000ms
  authRoutesDelay?: number;          // Default: 100ms (after auth confirmation)
  priorityRoutes?: string[];         // Routes that get immediate connection
  deferredRoutes?: string[];         // Routes that get manual-only connection
}

/**
 * Default timing configuration - OPTIMIZED FOR UX
 */
const DEFAULT_TIMING_CONFIG: TunnelTimingConfig = {
  strategy: TunnelTimingStrategy.PROGRESSIVE,
  delayedAutoDelay: 300,           // Faster initial connection (was 500ms)
  progressiveDesktopDelay: 0,      // Immediate on desktop - PERFECT for fast networks
  progressiveMobileDelay: 500,     // Reduced mobile delay (was 1000ms) - BETTER UX
  authRoutesDelay: 50,             // Ultra-fast auth connection (was 100ms)
  priorityRoutes: ['/profile', '/wallet', '/notifications', '/dashboard'],
  deferredRoutes: ['/docs', '/about', '/contact', '/blog']
};

/**
 * Detect if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent
  ) || window.innerWidth <= 768;
}

/**
 * Detect if device is desktop
 */
export function isDesktopDevice(): boolean {
  return !isMobileDevice();
}

/**
 * Get connection delay based on strategy and device
 */
export function getConnectionDelay(
  config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG,
  route?: string
): number | null {
  // Check if route requires immediate connection
  if (route && config.priorityRoutes?.includes(route)) {
    return config.authRoutesDelay || 100;
  }

  // Check if route should be deferred to manual only
  if (route && config.deferredRoutes?.includes(route)) {
    return null; // Manual only
  }

  switch (config.strategy) {
    case TunnelTimingStrategy.DELAYED_AUTO:
      return config.delayedAutoDelay || 500;

    case TunnelTimingStrategy.MANUAL_ONLY:
      return null; // Manual only - no auto-connect

    case TunnelTimingStrategy.PROGRESSIVE:
      if (isDesktopDevice()) {
        return config.progressiveDesktopDelay || 0; // Immediate
      } else {
        return config.progressiveMobileDelay || 1000; // Delayed for mobile
      }

    default:
      return config.delayedAutoDelay || 500;
  }
}

/**
 * Check if tunnel should auto-connect for a given route
 */
export function shouldAutoConnect(
  config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG,
  route?: string
): boolean {
  const delay = getConnectionDelay(config, route);
  return delay !== null;
}

/**
 * Initialize tunnel with timing strategy
 */
export async function initializeTunnelWithTiming(
  config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG,
  route?: string
): Promise<void> {
  const delay = getConnectionDelay(config, route);

  if (delay === null) {
    // Manual only - don't auto-connect
    console.log('TunnelTiming: Manual connection strategy - no auto-connect');
    return;
  }

  if (delay === 0) {
    // Immediate connection
    console.log('TunnelTiming: Immediate connection strategy');
    await connectTunnel();
  } else {
    // Delayed connection
    console.log(`TunnelTiming: Delayed connection strategy - connecting in ${delay}ms`);
    setTimeout(async () => {
      await connectTunnel();
    }, delay);
  }
}

/**
 * Connect tunnel with error handling
 */
async function connectTunnel(): Promise<void> {
  try {
    const manager = getTunnelTransportManager({
      debug: process.env.NODE_ENV === 'development'
    });

    await manager.connect();
    console.log('TunnelTiming: Tunnel connected successfully');
  } catch (error) {
    console.error('TunnelTiming: Failed to connect tunnel:', error);

    // Graceful degradation - continue without tunnel
    if (typeof window !== 'undefined') {
      (window as any).__TUNNEL_READY__ = false;
    }
  }
}

/**
 * Force manual tunnel connection (for manual-only strategy)
 */
export async function manualTunnelConnect(): Promise<void> {
  console.log('TunnelTiming: Manual tunnel connection requested');
  await connectTunnel();
}

/**
 * Get current timing strategy info for debugging
 */
export function getTimingStrategyInfo(
  config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG,
  route?: string
): {
  strategy: TunnelTimingStrategy;
  deviceType: 'mobile' | 'desktop';
  shouldAutoConnect: boolean;
  connectionDelay: number | null;
  route: string | undefined;
} {
  return {
    strategy: config.strategy,
    deviceType: isMobileDevice() ? 'mobile' : 'desktop',
    shouldAutoConnect: shouldAutoConnect(config, route),
    connectionDelay: getConnectionDelay(config, route),
    route
  };
}

/**
 * Hook for React components to use tunnel timing
 */
export function useTunnelTiming(
  config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG
) {
  const [timingInfo, setTimingInfo] = React.useState(() =>
    getTimingStrategyInfo(config)
  );

  const updateTimingInfo = React.useCallback((route?: string) => {
    setTimingInfo(getTimingStrategyInfo(config, route));
  }, [config]);

  const manualConnect = React.useCallback(async () => {
    await manualTunnelConnect();
  }, []);

  return {
    timingInfo,
    updateTimingInfo,
    manualConnect,
    isMobile: isMobileDevice(),
    isDesktop: isDesktopDevice()
  };
}

// Import React for the hook
import React from 'react';

/**
 * Tunnel Timing Manager Singleton
 */
class TunnelTimingManager {
  private config: TunnelTimingConfig = DEFAULT_TIMING_CONFIG;
  private initializedRoutes = new Set<string>();

  constructor() {
    this.config = this.loadConfigFromEnvironment();
  }

  private loadConfigFromEnvironment(): TunnelTimingConfig {
    const strategy = process.env.NEXT_PUBLIC_TUNNEL_TIMING_STRATEGY as TunnelTimingStrategy ||
                     TunnelTimingStrategy.PROGRESSIVE;

    return {
      ...DEFAULT_TIMING_CONFIG,
      strategy,
      delayedAutoDelay: parseInt(process.env.NEXT_PUBLIC_TUNNEL_DELAYED_AUTO_DELAY || '500'),
      progressiveDesktopDelay: parseInt(process.env.NEXT_PUBLIC_TUNNEL_DESKTOP_DELAY || '0'),
      progressiveMobileDelay: parseInt(process.env.NEXT_PUBLIC_TUNNEL_MOBILE_DELAY || '1000'),
      authRoutesDelay: parseInt(process.env.NEXT_PUBLIC_TUNNEL_AUTH_DELAY || '100'),
      priorityRoutes: process.env.NEXT_PUBLIC_TUNNEL_PRIORITY_ROUTES?.split(',') || DEFAULT_TIMING_CONFIG.priorityRoutes,
      deferredRoutes: process.env.NEXT_PUBLIC_TUNNEL_DEFERRED_ROUTES?.split(',') || DEFAULT_TIMING_CONFIG.deferredRoutes,
    };
  }

  /**
   * Initialize tunnel for a specific route
   */
  async initializeForRoute(route: string): Promise<void> {
    if (this.initializedRoutes.has(route)) {
      return; // Already initialized
    }

    this.initializedRoutes.add(route);
    await initializeTunnelWithTiming(this.config, route);
  }

  /**
   * Get current configuration
   */
  getConfig(): TunnelTimingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TunnelTimingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get timing strategy info for debugging
   */
  getTimingStrategyInfo(config?: TunnelTimingConfig, route?: string): ReturnType<typeof getTimingStrategyInfo> {
    return getTimingStrategyInfo(config || this.config, route);
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.initializedRoutes.clear();
    this.config = DEFAULT_TIMING_CONFIG;
  }
}

/**
 * Export singleton instance
 */
const tunnelTimingManager = new TunnelTimingManager();

export { tunnelTimingManager };
export default tunnelTimingManager;
