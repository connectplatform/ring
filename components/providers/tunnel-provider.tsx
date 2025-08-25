/**
 * Tunnel Provider Context
 * Provides a shared tunnel instance and subscription management across the app
 * Prevents duplicate subscriptions by centralizing tunnel management
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, use } from 'react';
import { useSession } from 'next-auth/react';
import { getTunnelTransportManager, TunnelTransportManager } from '@/lib/tunnel/transport-manager';
import {
  TunnelConnectionState,
  TunnelProvider as TunnelProviderType,
  TunnelMessage,
  TunnelHealth,
  TunnelConfig,
} from '@/lib/tunnel/types';

interface TunnelContextType {
  // Connection state
  isConnected: boolean;
  connectionState: TunnelConnectionState;
  provider: TunnelProviderType | null;
  
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
  switchProvider: (provider: TunnelProviderType) => Promise<void>;
  availableProviders: TunnelProviderType[];
  
  // Error state
  error: Error | null;
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
}

/**
 * Tunnel Provider Component
 * Manages a single shared tunnel instance for the entire app
 */
export function TunnelProvider({ 
  children, 
  config,
  autoConnect = true,
  debug = false 
}: TunnelProviderProps) {
  const { status: sessionStatus } = useSession();
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>(TunnelConnectionState.DISCONNECTED);
  const [provider, setProvider] = useState<TunnelProviderType | null>(null);
  const [health, setHealth] = useState<TunnelHealth | null>(null);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [availableProviders, setAvailableProviders] = useState<TunnelProviderType[]>([]);
  
  // Refs
  const managerRef = useRef<TunnelTransportManager | null>(null);
  const subscriptionsRef = useRef<Map<string, Map<symbol, (message: TunnelMessage) => void>>>(new Map());
  const channelSubscriptionsRef = useRef<Map<string, any>>(new Map());

  // Initialize manager once
  useEffect(() => {
    const manager = getTunnelTransportManager({
      ...config,
      debug,
    });
    
    managerRef.current = manager;
    
    // Capture ref values for cleanup
    const currentSubscriptions = subscriptionsRef.current;
    const currentChannelSubscriptions = channelSubscriptionsRef.current;
    
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
    
    const handleTransportSwitch = ({ from, to }: { from: TunnelProviderType; to: TunnelProviderType }) => {
      setProvider(to);
      if (debug) {
        console.log(`[TunnelProvider] Transport switched from ${from} to ${to}`);
      }
    };
    
    const handleMessage = (message: TunnelMessage) => {
      // Route message to channel handlers
      if (message.channel) {
        const handlers = subscriptionsRef.current.get(message.channel);
        if (handlers) {
          handlers.forEach(handler => handler(message));
        }
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
    
    // Auto-connect if enabled and authenticated
    if (autoConnect && sessionStatus === 'authenticated' && !manager.isConnected()) {
      manager.connect().catch(err => {
        console.error('[TunnelProvider] Failed to auto-connect:', err);
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
      
      // Clean up all subscriptions using captured variables
      for (const [channel, subscription] of currentChannelSubscriptions) {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      }
      currentSubscriptions.clear();
      currentChannelSubscriptions.clear();
    };
  }, [config, autoConnect, debug, sessionStatus]);

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
      // Clean up subscriptions
      for (const [channel, subscription] of channelSubscriptionsRef.current) {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          await subscription.unsubscribe();
        }
      }
      subscriptionsRef.current.clear();
      channelSubscriptionsRef.current.clear();
      
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

  // Subscribe method with deduplication
  const subscribe = useCallback((channel: string, handler: (message: TunnelMessage) => void) => {
    if (!managerRef.current) {
      console.error('[TunnelProvider] Transport manager not initialized');
      return () => {};
    }
    
    // Create a unique symbol for this handler
    const handlerKey = Symbol('handler');
    
    // Add handler to local registry
    if (!subscriptionsRef.current.has(channel)) {
      subscriptionsRef.current.set(channel, new Map());
    }
    subscriptionsRef.current.get(channel)!.set(handlerKey, handler);
    
    // Subscribe to channel if not already subscribed
    if (!channelSubscriptionsRef.current.has(channel)) {
      if (debug) {
        console.log(`[TunnelProvider] Creating new subscription for channel: ${channel}`);
      }
      
      managerRef.current
        .subscribe({ channel })
        .then(subscription => {
          channelSubscriptionsRef.current.set(channel, subscription);
        })
        .catch(err => {
          // Don't log errors for system/presence channels on anonymous connections
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
        });
    } else if (debug) {
      console.log(`[TunnelProvider] Reusing existing subscription for channel: ${channel}`);
    }
    
    // Return unsubscribe function
    return () => {
      const handlers = subscriptionsRef.current.get(channel);
      if (handlers) {
        handlers.delete(handlerKey);
        
        // If no more handlers, unsubscribe from channel
        if (handlers.size === 0) {
          if (debug) {
            console.log(`[TunnelProvider] Unsubscribing from channel: ${channel}`);
          }
          
          subscriptionsRef.current.delete(channel);
          
          const subscription = channelSubscriptionsRef.current.get(channel);
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
            channelSubscriptionsRef.current.delete(channel);
          }
        }
      }
    };
  }, [debug]);

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
