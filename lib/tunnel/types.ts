/**
 * Tunnel Transport Abstraction Layer
 * Provides unified interface for multiple real-time transport methods
 * Compatible with Vercel Edge Runtime and various deployment scenarios
 */

import { z } from 'zod';

/**
 * Supported transport providers
 */
export enum TunnelProvider {
  WEBSOCKET = 'websocket',
  SSE = 'sse',
  LONG_POLLING = 'polling',
  SUPABASE = 'supabase',
  FIREBASE = 'firebase',
  FIREBASE_EDGE = 'firebase-edge',
  PUSHER = 'pusher',
  ABLY = 'ably',
}

/**
 * Connection states for tunnel transport
 */
export enum TunnelConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Message types for unified protocol
 */
export enum TunnelMessageType {
  // Core message types
  DATA = 'data',
  NOTIFICATION = 'notification',
  MESSAGE = 'message',
  PRESENCE = 'presence',
  
  // System message types
  HEARTBEAT = 'heartbeat',
  ACK = 'ack',
  ERROR = 'error',
  AUTH = 'auth',
  
  // Database change events (for Supabase/Firebase)
  DB_INSERT = 'db_insert',
  DB_UPDATE = 'db_update',
  DB_DELETE = 'db_delete',
  DB_CHANGE = 'db_change',
}

/**
 * Unified message format across all transports
 */
export interface TunnelMessage {
  id: string;
  type: TunnelMessageType;
  channel?: string;
  event?: string;
  payload?: any;
  metadata?: {
    timestamp: number;
    userId?: string;
    sessionId?: string;
    provider?: TunnelProvider;
    [key: string]: any;
  };
}

/**
 * Transport health metrics
 */
export interface TunnelHealth {
  state: TunnelConnectionState;
  latency: number; // in milliseconds
  uptime: number; // in seconds
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastError?: string;
  lastActivity: number; // timestamp
  provider: TunnelProvider;
  providerSpecific?: Record<string, any>;
}

/**
 * Subscription options
 */
export interface TunnelSubscriptionOptions {
  channel: string;
  events?: string[];
  presence?: boolean;
  history?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Subscription handle for managing subscriptions
 */
export interface TunnelSubscription {
  id: string;
  channel: string;
  unsubscribe: () => void;
}

/**
 * Event handler type - generic to support different event payloads
 */
export type TunnelEventHandler<T = any> = (data: T) => void;

/**
 * Connection options for transport initialization
 */
export interface TunnelConnectionOptions {
  url?: string;
  auth?: {
    token?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  };
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
  debug?: boolean;
  
  // Provider-specific options
  supabase?: {
    url: string;
    anonKey: string;
    realtimeUrl?: string;
  };
  firebase?: {
    config?: any;
    useEdge?: boolean; // Use Edge-compatible libraries
  };
  pusher?: {
    appId?: string;
    key: string;
    secret?: string;
    cluster?: string;
  };
  ably?: {
    key: string;
    clientId?: string;
  };
}

/**
 * Core interface for all tunnel transports
 * All transport implementations must implement this interface
 */
export interface TunnelTransport {
  // Connection management
  connect(options?: TunnelConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionState(): TunnelConnectionState;
  
  // Messaging
  publish(channel: string, event: string, data: any): Promise<void>;
  subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription>;
  unsubscribe(subscriptionId: string): Promise<void>;
  
  // Event handling
  on(event: string, handler: TunnelEventHandler<any>): void;
  off(event: string, handler?: TunnelEventHandler<any>): void;
  once(event: string, handler: TunnelEventHandler<any>): void;
  
  // Health and diagnostics
  getHealth(): TunnelHealth;
  getLatency(): Promise<number>;
  getProvider(): TunnelProvider;
  
  // Provider-specific features (optional)
  getProviderClient?(): any; // Access underlying provider client if needed
  setDebug?(enabled: boolean): void;
}

/**
 * Factory function type for creating transports
 */
export type TunnelTransportFactory = (
  options?: TunnelConnectionOptions
) => TunnelTransport;

/**
 * Transport capabilities for feature detection
 */
export interface TunnelTransportCapabilities {
  bidirectional: boolean;
  binary: boolean;
  presence: boolean;
  history: boolean;
  guaranteed: boolean;
  edgeCompatible: boolean;
  offlineSupport: boolean;
  maxMessageSize?: number;
  maxChannels?: number;
  maxConnections?: number;
}

/**
 * Transport registry entry
 */
export interface TunnelTransportRegistration {
  provider: TunnelProvider;
  factory: TunnelTransportFactory;
  capabilities: TunnelTransportCapabilities;
  priority: number; // Lower number = higher priority
  isAvailable: () => boolean | Promise<boolean>;
}

/**
 * Configuration for tunnel manager
 */
export interface TunnelConfig {
  // Primary transport selection
  transport: TunnelProvider | 'auto';
  
  // Fallback chain (in order of preference)
  fallbackChain?: TunnelProvider[];
  
  // Connection options
  connection?: TunnelConnectionOptions;
  
  // Retry and reconnection
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
    maxDelay?: number;
  };
  
  // Health monitoring
  healthCheck?: {
    enabled: boolean;
    interval: number;
    failureThreshold: number;
    successThreshold: number;
  };
  
  // Performance optimization
  optimization?: {
    bundleMessages: boolean;
    compression: boolean;
    caching: boolean;
    prefetch: boolean;
  };
  
  // Debug and logging
  debug?: boolean;
  logger?: (level: string, message: string, data?: any) => void;
}

/**
 * Zod schema for configuration validation
 */
export const TunnelConfigSchema = z.object({
  transport: z.union([
    z.nativeEnum(TunnelProvider),
    z.literal('auto')
  ]),
  fallbackChain: z.array(z.nativeEnum(TunnelProvider)).optional(),
  connection: z.object({
    url: z.string().optional(),
    auth: z.object({
      token: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      params: z.record(z.string(), z.string()).optional(),
    }).optional(),
    reconnect: z.boolean().optional(),
    reconnectDelay: z.number().optional(),
    maxReconnectAttempts: z.number().optional(),
    heartbeatInterval: z.number().optional(),
    timeout: z.number().optional(),
    debug: z.boolean().optional(),
    supabase: z.object({
      url: z.string(),
      anonKey: z.string(),
      realtimeUrl: z.string().optional(),
    }).optional(),
    firebase: z.object({
      config: z.any().optional(),
      useEdge: z.boolean().optional(),
    }).optional(),
    pusher: z.object({
      appId: z.string().optional(),
      key: z.string(),
      secret: z.string().optional(),
      cluster: z.string().optional(),
    }).optional(),
    ably: z.object({
      key: z.string(),
      clientId: z.string().optional(),
    }).optional(),
  }).optional(),
  retry: z.object({
    enabled: z.boolean(),
    maxAttempts: z.number(),
    delay: z.number(),
    backoff: z.enum(['linear', 'exponential']),
    maxDelay: z.number().optional(),
  }).optional(),
  healthCheck: z.object({
    enabled: z.boolean(),
    interval: z.number(),
    failureThreshold: z.number(),
    successThreshold: z.number(),
  }).optional(),
  optimization: z.object({
    bundleMessages: z.boolean(),
    compression: z.boolean(),
    caching: z.boolean(),
    prefetch: z.boolean(),
  }).optional(),
  debug: z.boolean().optional(),
  // Logger is excluded from Zod validation as it's a complex function type
});

/**
 * Type-safe configuration type
 */
export type ValidatedTunnelConfig = z.infer<typeof TunnelConfigSchema>;

/**
 * Event types emitted by tunnel transports
 */
export interface TunnelEvents {
  // Connection events
  'connect': void;
  'disconnect': { reason?: string };
  'reconnect': { attempt: number };
  'error': { error: Error };
  
  // Message events
  'message': TunnelMessage;
  'notification': TunnelMessage;
  'presence': TunnelMessage;
  
  // Health events
  'health': TunnelHealth;
  'latency': { value: number };
  
  // Transport events
  'transport:switch': { from: TunnelProvider; to: TunnelProvider };
  'transport:fallback': { current: TunnelProvider; next: TunnelProvider };
}

/**
 * Type-safe event emitter interface
 */
export interface TunnelEventEmitter {
  on<K extends keyof TunnelEvents>(
    event: K,
    handler: (data: TunnelEvents[K]) => void
  ): void;
  
  off<K extends keyof TunnelEvents>(
    event: K,
    handler?: (data: TunnelEvents[K]) => void
  ): void;
  
  emit<K extends keyof TunnelEvents>(
    event: K,
    data: TunnelEvents[K]
  ): void;
}

/**
 * Default configuration values
 */
export const TUNNEL_DEFAULTS = {
  transport: 'auto' as const,
  fallbackChain: [
    TunnelProvider.SUPABASE,
    TunnelProvider.SSE,
    TunnelProvider.LONG_POLLING,
  ],
  retry: {
    enabled: true,
    maxAttempts: 10,
    delay: 1000,
    backoff: 'exponential' as const,
    maxDelay: 30000,
  },
  healthCheck: {
    enabled: true,
    interval: 30000,
    failureThreshold: 3,
    successThreshold: 1,
  },
  optimization: {
    bundleMessages: true,
    compression: false,
    caching: true,
    prefetch: true,
  },
  debug: process.env.NODE_ENV === 'development',
};
