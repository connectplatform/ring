/**
 * useTunnelTiming Hook
 * Provides access to tunnel timing strategy and manual connection controls
 */

import { useCallback, useMemo } from 'react';
import { useTunnelContext } from '@/components/providers/tunnel-provider';
import { tunnelTimingManager, TunnelTimingStrategy } from '@/lib/tunnel/tunnel-timing';

export interface TunnelTimingInfo {
  strategy: TunnelTimingStrategy;
  deviceType: 'mobile' | 'desktop';
  shouldAutoConnect: boolean;
  connectionDelay: number | null;
  route: string | undefined;
}

export function useTunnelTiming() {
  const { manualConnect: contextManualConnect } = useTunnelContext();

  const timingInfo = useMemo((): TunnelTimingInfo => {
    const config = tunnelTimingManager.getConfig();
    const info = tunnelTimingManager.getTimingStrategyInfo(config);

    return {
      strategy: info.strategy,
      deviceType: info.deviceType,
      shouldAutoConnect: info.shouldAutoConnect,
      connectionDelay: info.connectionDelay,
      route: info.route
    };
  }, []);

  const manualConnect = useCallback(async () => {
    if (contextManualConnect) {
      await contextManualConnect();
    } else {
      // Fallback to timing manager
      const { manualTunnelConnect } = await import('@/lib/tunnel/tunnel-timing');
      await manualTunnelConnect();
    }
  }, [contextManualConnect]);

  const updateTimingForRoute = useCallback((route: string) => {
    tunnelTimingManager.initializeForRoute(route);
  }, []);

  const getTimingConfig = useCallback(() => {
    return tunnelTimingManager.getConfig();
  }, []);

  const updateTimingConfig = useCallback((config: Partial<Parameters<typeof tunnelTimingManager.updateConfig>[0]>) => {
    tunnelTimingManager.updateConfig(config);
  }, []);

  return {
    timingInfo,
    manualConnect,
    updateTimingForRoute,
    getTimingConfig,
    updateTimingConfig
  };
}
