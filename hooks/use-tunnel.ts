/**
 * React Hook for Tunnel Transport
 * Primary hook for real-time communication with automatic transport selection
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getTunnelTransportManager, TunnelTransportManager } from '@/lib/tunnel/transport-manager';
import {
  TunnelConnectionState,
  TunnelProvider,
  TunnelMessage,
  TunnelHealth,
  TunnelSubscription,
  TunnelConfig,
} from '@/lib/tunnel/types';

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
 */
export function useTunnel(options: UseTunnelOptions = {}): UseTunnelReturn {
  const { config, autoConnect = true, debug = false } = options;
  
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
  const subscriptionsRef = useRef<Map<string, TunnelSubscription>>(new Map());
  const handlersRef = useRef<Map<string, Set<(message: TunnelMessage) => void>>>(new Map());

  // Get or create manager
  useEffect(() => {
    const manager = getTunnelTransportManager({
      ...config,
      debug,
    });
    
    managerRef.current = manager;
    
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
      // Route message to channel handlers
      if (message.channel) {
        const handlers = handlersRef.current.get(message.channel);
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
      // Clean up subscriptions
      for (const [channel, subscription] of subscriptionsRef.current) {
        await subscription.unsubscribe();
      }
      subscriptionsRef.current.clear();
      handlersRef.current.clear();
      
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

  // Subscribe method
  const subscribe = useCallback((channel: string, handler: (message: TunnelMessage) => void) => {
    if (!managerRef.current) {
      console.error('Transport manager not initialized');
      return () => {};
    }
    
    // Add handler to local registry
    if (!handlersRef.current.has(channel)) {
      handlersRef.current.set(channel, new Set());
    }
    handlersRef.current.get(channel)!.add(handler);
    
    // Subscribe if not already subscribed
    if (!subscriptionsRef.current.has(channel)) {
      managerRef.current
        .subscribe({ channel })
        .then(subscription => {
          subscriptionsRef.current.set(channel, subscription);
        })
        .catch(err => {
          // Don't log errors for system/presence channels on anonymous connections
          const isSystemChannel = channel === 'system' || channel === 'presence';
          const isAuthError = err.message?.includes('401') || err.message?.includes('Unauthorized');
          
          if (isSystemChannel && isAuthError) {
            // Silently ignore - anonymous users can't subscribe to these channels
            console.log(`[Tunnel] Anonymous user cannot subscribe to ${channel} channel`);
          } else {
            console.error(`Failed to subscribe to ${channel}:`, err);
            setError(err);
          }
        });
    }
    
    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(channel);
      if (handlers) {
        handlers.delete(handler);
        
        // If no more handlers, unsubscribe from channel
        if (handlers.size === 0) {
          handlersRef.current.delete(channel);
          
          const subscription = subscriptionsRef.current.get(channel);
          if (subscription) {
            subscription.unsubscribe();
            subscriptionsRef.current.delete(channel);
          }
        }
      }
    };
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

/**
 * Hook for subscribing to tunnel notifications
 */
export function useTunnelNotifications(options: UseTunnelOptions = {}) {
  const tunnel = useTunnel(options);
  const [notifications, setNotifications] = useState<TunnelMessage[]>([]);

  useEffect(() => {
    if (!tunnel.isConnected) return;

    const unsubscribe = tunnel.subscribe('notifications', (message) => {
      setNotifications(prev => [...prev, message]);
    });

    return unsubscribe;
  }, [tunnel.isConnected, tunnel.subscribe]);

  return {
    ...tunnel,
    notifications,
    clearNotifications: () => setNotifications([]),
  };
}

/**
 * Hook for subscribing to tunnel messages
 */
export function useTunnelMessages(channel: string, options: UseTunnelOptions = {}) {
  const tunnel = useTunnel(options);
  const [messages, setMessages] = useState<TunnelMessage[]>([]);

  useEffect(() => {
    if (!tunnel.isConnected || !channel) return;

    const unsubscribe = tunnel.subscribe(channel, (message) => {
      setMessages(prev => [...prev, message]);
    });

    return unsubscribe;
  }, [tunnel.isConnected, tunnel.subscribe, channel]);

  const sendMessage = useCallback(
    async (data: any) => {
      await tunnel.publish(channel, 'message', data);
    },
    [tunnel.publish, channel]
  );

  return {
    ...tunnel,
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
  };
}

/**
 * Hook for tunnel presence tracking
 */
export function useTunnelPresence(channel: string, options: UseTunnelOptions = {}) {
  const tunnel = useTunnel(options);
  const [presence, setPresence] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!tunnel.isConnected || !channel) return;

    const unsubscribe = tunnel.subscribe(channel, (message) => {
      if (message.type === 'presence') {
        const { event, payload } = message;
        
        if (event === 'join') {
          setPresence(prev => {
            const next = new Map(prev);
            next.set(payload.userId, payload);
            return next;
          });
        } else if (event === 'leave') {
          setPresence(prev => {
            const next = new Map(prev);
            next.delete(payload.userId);
            return next;
          });
        } else if (event === 'sync') {
          setPresence(new Map(Object.entries(payload)));
        }
      }
    });

    return unsubscribe;
  }, [tunnel.isConnected, tunnel.subscribe, channel]);

  return {
    ...tunnel,
    presence: Array.from(presence.values()),
    presenceMap: presence,
  };
}
