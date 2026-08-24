/**
 * Tunnel Provider Context
 * Provides a shared tunnel instance and subscription management across the app
 * Prevents duplicate subscriptions by centralizing tunnel management
 */

'use client';

import React, { createContext, useEffect, useRef, useState, useCallback, useMemo, use } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { getTunnelTransportManager, TunnelTransportManager } from '@/lib/tunnel/transport-manager';
import {
  TunnelConnectionState,
  TunnelProvider as TunnelProviderType,
  TunnelMessage,
  TunnelHealth,
  TunnelConfig,
} from '@/lib/tunnel/types';
import { tunnelTimingManager, TunnelTimingStrategy } from '@/lib/tunnel/tunnel-timing';
import { toast } from '@/hooks/use-toast';
import {
  type TunnelContextValue,
} from '@/lib/tunnel/disconnected-tunnel-context';
import {
  createChannelSubscriptionRegistry,
  type ChannelSubscriptionRegistry,
} from '@/lib/tunnel/channel-subscription-registry';

export type TunnelContextType = Omit<TunnelContextValue, 'health' | 'publish' | 'subscribe'> & {
  health: TunnelHealth | null
  publish: (channel: string, event: string, data: unknown) => Promise<void>
  subscribe: (channel: string, handler: (message: TunnelMessage) => void) => () => void
}

export const TunnelContext = createContext<TunnelContextType | null>(null);

export function useTunnelContext() {
  const context = use(TunnelContext);
  if (!context) {
    throw new Error('useTunnelContext must be used within TunnelProvider');
  }
  return context;
}

interface TunnelProviderProps {
  children: React.ReactNode;
  config?: Partial<TunnelConfig>;
  autoConnect?: boolean;
  debug?: boolean;
  timingStrategy?: TunnelTimingStrategy;
}

/**
 * Tunnel Provider — runtime is the only tree that owns `children`.
 *
 * Do not put App Router `children` in a Suspense fallback *and* in the resolved
 * tree: Next.js 16 hydrates that slot once. Duplicating it leaves SSR chrome
 * frozen (icon rail, dead theme / lang / [+] / Login).
 *
 * K8s: `autoConnect={false}` defers hook-level connect; TunnelProvider still
 * runs tunnelTimingManager progressive connect after auth/pathname resolve.
 */
export function TunnelProvider(props: TunnelProviderProps) {
  return <TunnelProviderRuntime {...props} />
}

function TunnelProviderRuntime({
  children,
  config,
  autoConnect = true,
  debug = false,
  timingStrategy = TunnelTimingStrategy.PROGRESSIVE
}: TunnelProviderProps) {
  const { status: sessionStatus, data: session } = useSession();
  const pathname = usePathname();
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>(TunnelConnectionState.DISCONNECTED);
  const [provider, setProvider] = useState<TunnelProviderType | null>(null);
  const [health, setHealth] = useState<TunnelHealth | null>(null);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [availableProviders, setAvailableProviders] = useState<TunnelProviderType[]>([]);
  // Authentication racing protection
  const [lastAuthTime, setLastAuthTime] = useState<number | null>(null);
  
  // Refs
  const managerRef = useRef<TunnelTransportManager | null>(null);
  const registryRef = useRef<ChannelSubscriptionRegistry | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const sessionUserIdRef = useRef<string | null>(null);
  sessionUserIdRef.current = session?.user?.id ?? null;

  // Track authentication state changes for racing protection
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !lastAuthTime) {
      setLastAuthTime(Date.now());
      console.log('[TunnelProvider] Authentication completed - enabling racing protection');
    }
  }, [sessionStatus, lastAuthTime]);

  // Effect A — initialize manager and event listeners (mount only; no route/session teardown)
  useEffect(() => {
    tunnelTimingManager.updateConfig({
      strategy: timingStrategy
    });

    const manager = getTunnelTransportManager({
      ...config,
      debug,
    });

    managerRef.current = manager;

    registryRef.current = createChannelSubscriptionRegistry({
      subscribeTransport: ({ channel }) => manager.subscribe({ channel }),
      debug,
      onError: (err, channel) => {
        const isSystemChannel = channel === 'system' || channel === 'presence';
        const isAuthError = err.message?.includes('401') || err.message?.includes('Unauthorized');

        if (isSystemChannel && isAuthError) {
          if (debug) {
            console.log(`[TunnelProvider] Anonymous user cannot subscribe to ${channel} channel`);
          }
        } else {
          console.error(`[TunnelProvider] Failed to subscribe to ${channel}:`, err);
          setError(err);
        }
      },
    });

    const registry = registryRef.current;

    setIsConnected(manager.isConnected());
    setConnectionState(manager.getConnectionState());
    setProvider(manager.getProvider());
    setAvailableProviders(manager.getAvailableProviders());

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionState(TunnelConnectionState.CONNECTED);
      setProvider(manager.getProvider());
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionState(TunnelConnectionState.DISCONNECTED);
    };

    const handleReconnect = ({ attempt }: { attempt: number }) => {
      setConnectionState(TunnelConnectionState.RECONNECTING);
    };

    const handleError = ({ error: err }: { error: Error }) => {
      setError(err);
      setConnectionState(TunnelConnectionState.ERROR);

      if (err.message.includes('SSE') || manager.getProvider() === TunnelProviderType.SSE) {
        toast({
          title: '🔄 Reconnection',
          description: 'Attempting to restore connection...',
          variant: 'default',
          duration: 3000,
        });
      }
    };

    const handleHealth = (healthData: TunnelHealth) => {
      setHealth(healthData);
    };

    const handleLatency = ({ value }: { value: number }) => {
      setLatency(value);
    };

    const handleTransportSwitch = ({ from, to }: { from: TunnelProviderType; to: TunnelProviderType }) => {
      setProvider(to);
      if (debug) {
        console.log(`[TunnelProvider] Transport switched from ${from} to ${to}`);
      }
    };

    const handleMessage = (message: TunnelMessage) => {
      if (!message.channel) {
        return
      }

      const dispatch = (channel: string) => {
        registry?.dispatch(channel, message)
      }

      dispatch(message.channel)

      // User inbox messages use base channel on wire; legacy subscribers may use :userId suffix
      const userId = sessionUserIdRef.current
      const metaUserId = message.metadata?.userId as string | undefined
      if (userId && metaUserId === userId) {
        dispatch(`${message.channel}:${userId}`)
      }
    };

    manager.on('connect', handleConnect);
    manager.on('disconnect', handleDisconnect);
    manager.on('reconnect', handleReconnect);
    manager.on('error', handleError);
    manager.on('health', handleHealth);
    manager.on('latency', handleLatency);
    manager.on('transport:switch', handleTransportSwitch);
    manager.on('message', handleMessage);

    return () => {
      manager.off('connect', handleConnect);
      manager.off('disconnect', handleDisconnect);
      manager.off('reconnect', handleReconnect);
      manager.off('error', handleError);
      manager.off('health', handleHealth);
      manager.off('latency', handleLatency);
      manager.off('transport:switch', handleTransportSwitch);
      manager.off('message', handleMessage);

      registry?.clearAll();
      registryRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, debug, timingStrategy]);

  // Effect B — session-aware initial connect with auth grace (no subscription teardown)
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || sessionStatus === 'loading' || manager.isConnected()) {
      return;
    }

    const now = Date.now();
    const timeSinceAuth = lastAuthTime ? now - lastAuthTime : Infinity;
    const authGraceMs = 400;
    const isRecentlyAuthenticated = sessionStatus === 'authenticated' && timeSinceAuth < authGraceMs;

    if (isRecentlyAuthenticated) {
      const timeoutId = setTimeout(() => {
        if (!manager.isConnected()) {
          void tunnelTimingManager.initializeForRoute(pathnameRef.current).catch(err => {
            console.error('[TunnelProvider] Failed to initialize tunnel with timing:', err);
            setError(err);
          });
        }
      }, Math.max(0, authGraceMs - timeSinceAuth));
      return () => clearTimeout(timeoutId);
    }

    void tunnelTimingManager.initializeForRoute(pathnameRef.current).catch(err => {
      console.error('[TunnelProvider] Failed to initialize tunnel with timing:', err);
      setError(err);
    });
  }, [sessionStatus, lastAuthTime]);

  // Effect C — route timing updates without tearing down channel subscriptions
  useEffect(() => {
    if (sessionStatus === 'loading') {
      return;
    }
    void tunnelTimingManager.initializeForRoute(pathname);
  }, [pathname, sessionStatus]);

  // Connect method
  const connect = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      setError(null);
      setConnectionState(TunnelConnectionState.CONNECTING);
      await managerRef.current.connect();
    } catch (err) {
      setError(err as Error);
      setConnectionState(TunnelConnectionState.ERROR);
      throw err;
    }
  }, []);

  // Manual connect method (for manual-only timing strategy)
  const manualConnect = useCallback(async () => {
    console.log('[TunnelProvider] Manual connect requested');
    await connect();
  }, [connect]);

  // Disconnect method
  const disconnect = useCallback(async () => {
    if (!managerRef.current) return;
    
    try {
      registryRef.current?.clearAll();
      
      await managerRef.current.disconnect();
    } catch (err) {
      console.error('[TunnelProvider] Failed to disconnect:', err);
      setError(err as Error);
    }
  }, []);

  // Publish method
  const publish = useCallback(async (channel: string, event: string, data: any) => {
    if (!managerRef.current) {
      throw new Error('Transport manager not initialized');
    }
    
    if (!managerRef.current.isConnected()) {
      throw new Error('Not connected');
    }
    
    await managerRef.current.publish(channel, event, data);
  }, []);

  // Subscribe method — delegates to channel subscription registry (SSOT dedup)
  const subscribe = useCallback((channel: string, handler: (message: TunnelMessage) => void) => {
    if (!registryRef.current) {
      console.error('[TunnelProvider] Transport manager not initialized');
      return () => {};
    }

    return registryRef.current.subscribe(channel, handler);
  }, []);

  // Switch provider method
  const switchProvider = useCallback(async (newProvider: TunnelProviderType) => {
    if (!managerRef.current) {
      throw new Error('Transport manager not initialized');
    }
    
    try {
      setError(null);
      await managerRef.current.switchProvider(newProvider);
      setProvider(newProvider);
    } catch (err) {
      console.error(`[TunnelProvider] Failed to switch to ${newProvider}:`, err);
      setError(err as Error);
      throw err;
    }
  }, []);

  // Memoize context value
  const contextValue = useMemo<TunnelContextType>(() => ({
    // Connection state
    isConnected,
    connectionState,
    provider,

    // Connection management
    connect,
    disconnect,
    manualConnect,

    // Messaging
    publish,
    subscribe,

    // Health and diagnostics
    health,
    latency,

    // Transport management
    switchProvider,
    availableProviders,

    // Error state
    error,
  }), [
    isConnected,
    connectionState,
    provider,
    connect,
    disconnect,
    manualConnect,
    publish,
    subscribe,
    health,
    latency,
    switchProvider,
    availableProviders,
    error,
  ]);

  return (
    <TunnelContext.Provider value={contextValue}>
      {children}
    </TunnelContext.Provider>
  );
}
