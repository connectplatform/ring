/**
 * React Hook for Tunnel Transport
 * Primary hook for real-time communication with automatic transport selection
 */

'use client';

import { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { getTunnelTransportManager, TunnelTransportManager } from '@/lib/tunnel/transport-manager';
import {
  TunnelConnectionState,
  TunnelProvider,
  TunnelMessage,
  TunnelHealth,
  TunnelConfig,
} from '@/lib/tunnel/types';
import {
  createChannelSubscriptionRegistry,
  type ChannelSubscriptionRegistry,
} from '@/lib/tunnel/channel-subscription-registry';

// Optional import - provider may not be in use
let TunnelContext: React.Context<any> | undefined;
try {
  // Try to import the context if provider is available
  const provider = require('@/components/providers/tunnel-provider');
  TunnelContext = provider.TunnelContext;
} catch {
  // Provider not available, will use standalone mode
  TunnelContext = undefined;
}

export interface UseTunnelOptions {
  config?: Partial<TunnelConfig>;
  autoConnect?: boolean;
  debug?: boolean;
}

export interface UseTunnelReturn {
  // Connection state
  isConnected: boolean;
  connectionState: TunnelConnectionState;
  provider: TunnelProvider | null;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Messaging
  publish: (channel: string, event: string, data: any) => Promise<void>;
  subscribe: (channel: string, handler: (message: TunnelMessage) => void) => () => void;
  
  // Health and diagnostics
  health: TunnelHealth | null;
  latency: number;
  
  // Transport management
  switchProvider: (provider: TunnelProvider) => Promise<void>;
  availableProviders: TunnelProvider[];
  
  // Error state
  error: Error | null;
}

/**
 * Main hook for tunnel transport
 * Uses TunnelContext if available, otherwise creates standalone instance
 */
export function useTunnel(options: UseTunnelOptions = {}): UseTunnelReturn {
  const { config, autoConnect = true, debug = false } = options;
  
  // Try to use context if available
  const contextValue = TunnelContext ? useContext(TunnelContext) : null;
  
  // If context is available and initialized, return it directly
  if (contextValue) {
    return contextValue as UseTunnelReturn;
  }
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>(TunnelConnectionState.DISCONNECTED);
  const [provider, setProvider] = useState<TunnelProvider | null>(null);
  const [health, setHealth] = useState<TunnelHealth | null>(null);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [availableProviders, setAvailableProviders] = useState<TunnelProvider[]>([]);
  
  // Refs
  const managerRef = useRef<TunnelTransportManager | null>(null);
  const registryRef = useRef<ChannelSubscriptionRegistry | null>(null);

  // Get or create manager
  useEffect(() => {
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
            console.log(`[Tunnel] Anonymous user cannot subscribe to ${channel} channel`);
          }
        } else {
          console.error(`[Tunnel] Failed to subscribe to ${channel}:`, err);
          setError(err);
        }
      },
    });

    const registry = registryRef.current;
    // Set initial state
    setIsConnected(manager.isConnected());
    setConnectionState(manager.getConnectionState());
    setProvider(manager.getProvider());
    setAvailableProviders(manager.getAvailableProviders());
    
    // Set up event listeners
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
    };
    
    const handleHealth = (healthData: TunnelHealth) => {
      setHealth(healthData);
    };
    
    const handleLatency = ({ value }: { value: number }) => {
      setLatency(value);
    };
    
    const handleTransportSwitch = ({ from, to }: { from: TunnelProvider; to: TunnelProvider }) => {
      setProvider(to);
      console.log(`Transport switched from ${from} to ${to}`);
    };
    
    const handleMessage = (message: TunnelMessage) => {
      if (message.channel) {
        registry?.dispatch(message.channel, message);
      }
    };
    
    // Register event listeners
    manager.on('connect', handleConnect);
    manager.on('disconnect', handleDisconnect);
    manager.on('reconnect', handleReconnect);
    manager.on('error', handleError);
    manager.on('health', handleHealth);
    manager.on('latency', handleLatency);
    manager.on('transport:switch', handleTransportSwitch);
    manager.on('message', handleMessage);
    
    // Auto-connect if enabled
    if (autoConnect && !manager.isConnected()) {
      manager.connect().catch(err => {
        console.error('Failed to auto-connect:', err);
        setError(err);
      });
    }
    
    // Cleanup
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
  }, [config, autoConnect, debug]);

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

  // Disconnect method
  const disconnect = useCallback(async () => {
    if (!managerRef.current) return;
    
    try {
      registryRef.current?.clearAll();
      
      await managerRef.current.disconnect();
    } catch (err) {
      console.error('Failed to disconnect:', err);
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
      console.error('Transport manager not initialized');
      return () => {};
    }

    return registryRef.current.subscribe(channel, handler);
  }, []);

  // Switch provider method
  const switchProvider = useCallback(async (newProvider: TunnelProvider) => {
    if (!managerRef.current) {
      throw new Error('Transport manager not initialized');
    }
    
    try {
      setError(null);
      await managerRef.current.switchProvider(newProvider);
      setProvider(newProvider);
    } catch (err) {
      console.error(`Failed to switch to ${newProvider}:`, err);
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    // Connection state
    isConnected,
    connectionState,
    provider,
    
    // Connection management
    connect,
    disconnect,
    
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
  };
}
