/**
 * Tunnel Configuration Management
 * Handles environment detection, provider selection, and configuration validation
 */

import { z } from 'zod';
import {
  TunnelProvider,
  TunnelConfig,
  TunnelConfigSchema,
  ValidatedTunnelConfig,
  TUNNEL_DEFAULTS,
  TunnelConnectionOptions,
} from './types';

/**
 * Environment detection for automatic transport selection
 */
export function detectEnvironment(): {
  isVercel: boolean;
  isEdgeRuntime: boolean;
  isFirebase: boolean;
  isNodeRuntime: boolean;
  isLocalhost: boolean;
  hasWebSocketSupport: boolean;
} {
  const isVercel = process.env.VERCEL === '1';
  const isEdgeRuntime = typeof globalThis.EdgeRuntime !== 'undefined' || 
                        process.env.NEXT_RUNTIME === 'edge';
  const isFirebase = !!process.env.FIREBASE_CONFIG || 
                     !!process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  const isNodeRuntime = typeof process !== 'undefined' && 
                        process.versions?.node !== undefined;
  const isLocalhost = typeof window !== 'undefined' && 
                      (window.location?.hostname === 'localhost' || 
                       window.location?.hostname === '127.0.0.1');
  const hasWebSocketSupport = typeof WebSocket !== 'undefined';

  return {
    isVercel,
    isEdgeRuntime,
    isFirebase,
    isNodeRuntime,
    isLocalhost,
    hasWebSocketSupport,
  };
}

/**
 * Detect available provider credentials
 */
export function detectProviderCredentials(): Set<TunnelProvider> {
  const available = new Set<TunnelProvider>();

  // Check for Supabase credentials
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    available.add(TunnelProvider.SUPABASE);
  }

  // Check for Firebase credentials
  if (process.env.NEXT_PUBLIC_FIREBASE_CONFIG || 
      process.env.FIREBASE_CONFIG) {
    const env = detectEnvironment();
    if (env.isEdgeRuntime && process.env.FIREBASE_EDGE_MODE === 'true') {
      available.add(TunnelProvider.FIREBASE_EDGE);
    } else if (env.isNodeRuntime) {
      available.add(TunnelProvider.FIREBASE);
    }
  }

  // Check for Pusher credentials
  if (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY) {
    available.add(TunnelProvider.PUSHER);
  }

  // Check for Ably credentials
  if (process.env.ABLY_API_KEY || process.env.NEXT_PUBLIC_ABLY_API_KEY) {
    available.add(TunnelProvider.ABLY);
  }

  // SSE and polling are always available
  available.add(TunnelProvider.SSE);
  available.add(TunnelProvider.LONG_POLLING);

  // WebSocket available in non-Vercel environments (Kubernetes/production)
  const env = detectEnvironment();
  const websocketDisabled = process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED === 'false';

  if (!env.isVercel && !websocketDisabled && env.hasWebSocketSupport) {
    available.add(TunnelProvider.WEBSOCKET);
  }

  // SSE only available when explicitly on Vercel (VERCEL=1)
  const isVercelEnv = process.env.VERCEL === '1';
  if (isVercelEnv) {
    available.add(TunnelProvider.SSE);
  }

  return available;
}

/**
 * Get recommended transport based on environment
 */
export function getRecommendedTransport(): TunnelProvider {
  const env = detectEnvironment();
  const available = detectProviderCredentials();

  // Check if WebSocket is explicitly disabled
  const websocketDisabled = process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED === 'false';

  // Vercel environment - NEVER use WebSocket
  if (env.isVercel || websocketDisabled) {
    // Remove WebSocket from available if on Vercel
    available.delete(TunnelProvider.WEBSOCKET);
    
    if (available.has(TunnelProvider.SUPABASE)) {
      return TunnelProvider.SUPABASE;
    }
    if (available.has(TunnelProvider.PUSHER)) {
      return TunnelProvider.PUSHER;
    }
    if (available.has(TunnelProvider.ABLY)) {
      return TunnelProvider.ABLY;
    }
    return TunnelProvider.SSE;
  }

  // Firebase environment - prefer Firebase
  if (env.isFirebase) {
    if (env.isEdgeRuntime && available.has(TunnelProvider.FIREBASE_EDGE)) {
      return TunnelProvider.FIREBASE_EDGE;
    }
    if (!env.isEdgeRuntime && available.has(TunnelProvider.FIREBASE)) {
      return TunnelProvider.FIREBASE;
    }
  }

  // Local development - prefer SSE (WebSocket server not running in dev)
  if (env.isLocalhost && available.has(TunnelProvider.SSE)) {
    return TunnelProvider.SSE;
  }

  // Private Kubernetes cluster with PostgreSQL - use WebSocket
  const isK8sPostgres = process.env.DB_HOST?.includes('postgres.') &&
                       process.env.DB_HOST?.includes('.svc.cluster.local') &&
                       process.env.DATABASE_URL?.startsWith('postgresql://');
  if (isK8sPostgres && available.has(TunnelProvider.WEBSOCKET)) {
    return TunnelProvider.WEBSOCKET;
  }

  // Self-hosted with Node.js - prefer WebSocket
  if (!env.isVercel && env.isNodeRuntime && available.has(TunnelProvider.WEBSOCKET)) {
    return TunnelProvider.WEBSOCKET;
  }

  // Default fallback order
  const preferenceOrder: TunnelProvider[] = [
    TunnelProvider.SUPABASE,
    TunnelProvider.WEBSOCKET,
    TunnelProvider.PUSHER,
    TunnelProvider.ABLY,
    TunnelProvider.FIREBASE,
    TunnelProvider.FIREBASE_EDGE,
    TunnelProvider.SSE,
    TunnelProvider.LONG_POLLING,
  ];

  for (const provider of preferenceOrder) {
    if (available.has(provider)) {
      return provider;
    }
  }

  // Ultimate fallback
  return TunnelProvider.LONG_POLLING;
}

/**
 * Build fallback chain based on available providers
 */
export function buildFallbackChain(
  primary?: TunnelProvider
): TunnelProvider[] {
  const available = detectProviderCredentials();
  const chain: TunnelProvider[] = [];

  // Add primary if specified and available
  if (primary && available.has(primary)) {
    chain.push(primary);
  }

  // Build fallback order
  const fallbackOrder: TunnelProvider[] = [
    TunnelProvider.SUPABASE,
    TunnelProvider.PUSHER,
    TunnelProvider.ABLY,
    TunnelProvider.SSE,
    TunnelProvider.FIREBASE_EDGE,
    TunnelProvider.FIREBASE,
    TunnelProvider.WEBSOCKET,
    TunnelProvider.LONG_POLLING,
  ];

  // Add available providers not already in chain
  for (const provider of fallbackOrder) {
    if (available.has(provider) && !chain.includes(provider)) {
      chain.push(provider);
    }
  }

  // Ensure at least SSE and polling as ultimate fallbacks
  if (!chain.includes(TunnelProvider.SSE)) {
    chain.push(TunnelProvider.SSE);
  }
  if (!chain.includes(TunnelProvider.LONG_POLLING)) {
    chain.push(TunnelProvider.LONG_POLLING);
  }

  return chain;
}

/**
 * Get connection options for a specific provider
 */
export function getProviderConnectionOptions(
  provider: TunnelProvider
): TunnelConnectionOptions {
  const options: TunnelConnectionOptions = {
    reconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    timeout: 15000,
  };

  switch (provider) {
    case TunnelProvider.SUPABASE:
      options.supabase = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        realtimeUrl: process.env.NEXT_PUBLIC_SUPABASE_REALTIME_URL,
      };
      break;

    case TunnelProvider.FIREBASE:
    case TunnelProvider.FIREBASE_EDGE:
      options.firebase = {
        config: process.env.NEXT_PUBLIC_FIREBASE_CONFIG 
          ? JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG)
          : undefined,
        useEdge: provider === TunnelProvider.FIREBASE_EDGE,
      };
      break;

    case TunnelProvider.PUSHER:
      options.pusher = {
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER || 'us2',
      };
      break;

    case TunnelProvider.ABLY:
      options.ably = {
        key: process.env.ABLY_API_KEY || process.env.NEXT_PUBLIC_ABLY_API_KEY!,
        clientId: process.env.NEXT_PUBLIC_ABLY_CLIENT_ID,
      };
      break;

    case TunnelProvider.WEBSOCKET:
      // SECURITY: Use secure WebSocket (wss://) for k8s-prod and dev environments
      // Vercel uses SSE (no WebSocket), so this only applies to self-hosted deployments
      if (process.env.NEXT_PUBLIC_WEBSOCKET_URL) {
        options.url = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
      } else if (typeof window !== 'undefined') {
        const isK8sProd = process.env.NEXT_PUBLIC_DEPLOY_ENV === 'k8s-prod';
        const isDev = process.env.NODE_ENV === 'development';
        
        // Force secure WebSocket for k8s-prod and dev
        if (isK8sProd || isDev) {
          options.url = `wss://${window.location.host}`;
        } else {
          // Auto-detect based on page protocol for other environments
          options.url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
        }
      } else {
        // Server-side fallback (dev environment)
        options.url = 'wss://localhost:3001';
      }
      break;

    case TunnelProvider.SSE:
      options.url = '/api/tunnel/sse';
      break;

    case TunnelProvider.LONG_POLLING:
      options.url = '/api/tunnel/poll';
      options.heartbeatInterval = 60000; // Longer interval for polling
      break;
  }

  return options;
}

/**
 * Load configuration from environment
 */
export function loadConfigFromEnvironment(): TunnelConfig {
  const transport = process.env.NEXT_PUBLIC_TUNNEL_TRANSPORT || 'auto';
  
  const config: TunnelConfig = {
    transport: transport === 'auto' ? 'auto' : transport as TunnelProvider,
    fallbackChain: process.env.NEXT_PUBLIC_TUNNEL_FALLBACK_CHAIN
      ? process.env.NEXT_PUBLIC_TUNNEL_FALLBACK_CHAIN.split(',').map(
          t => t.trim() as TunnelProvider
        )
      : undefined,
    retry: {
      enabled: process.env.NEXT_PUBLIC_TUNNEL_RETRY_ENABLED !== 'false',
      maxAttempts: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_MAX_RECONNECT_ATTEMPTS || '10'
      ),
      delay: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_RECONNECT_DELAY || '1000'
      ),
      backoff: (process.env.NEXT_PUBLIC_TUNNEL_BACKOFF || 'exponential') as 
               'linear' | 'exponential',
      maxDelay: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_MAX_DELAY || '30000'
      ),
    },
    healthCheck: {
      enabled: process.env.NEXT_PUBLIC_TUNNEL_HEALTH_CHECK !== 'false',
      interval: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_HEARTBEAT_INTERVAL || '30000'
      ),
      adaptive: process.env.NEXT_PUBLIC_TUNNEL_ADAPTIVE_HEALTH !== 'false', // NEW: Enable adaptive health checking
      failureThreshold: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_FAILURE_THRESHOLD || '3'
      ),
      successThreshold: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_SUCCESS_THRESHOLD || '1'
      ),
      minInterval: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_HEALTH_MIN_INTERVAL || '15000'
      ),
      maxInterval: parseInt(
        process.env.NEXT_PUBLIC_TUNNEL_HEALTH_MAX_INTERVAL || '120000'
      ),
    },
    optimization: {
      bundleMessages: process.env.NEXT_PUBLIC_TUNNEL_BUNDLE_MESSAGES !== 'false',
      compression: process.env.NEXT_PUBLIC_TUNNEL_COMPRESSION === 'true',
      caching: process.env.NEXT_PUBLIC_TUNNEL_CACHING !== 'false',
      prefetch: process.env.NEXT_PUBLIC_TUNNEL_PREFETCH !== 'false',
    },
    debug: process.env.NEXT_PUBLIC_TUNNEL_DEBUG === 'true' ||
           process.env.NODE_ENV === 'development',
  };

  return config;
}

/**
 * Create and validate configuration
 */
export function createTunnelConfig(
  overrides?: Partial<TunnelConfig>
): ValidatedTunnelConfig {
  // Load from environment
  const envConfig = loadConfigFromEnvironment();
  
  // Merge with defaults and overrides
  const config: TunnelConfig = {
    ...TUNNEL_DEFAULTS,
    ...envConfig,
    ...overrides,
  };

  // Auto-detect transport if needed
  if (config.transport === 'auto') {
    config.transport = getRecommendedTransport();
  }

  // Build fallback chain if not provided
  if (!config.fallbackChain || config.fallbackChain.length === 0) {
    config.fallbackChain = buildFallbackChain(
      config.transport as TunnelProvider
    );
  }

  // Get connection options for primary transport
  if (config.transport && config.transport !== ('auto' as unknown as TunnelProvider)) {
    config.connection = {
      ...getProviderConnectionOptions(config.transport as TunnelProvider),
      ...config.connection,
    };
  }

  // Validate configuration
  try {
    return TunnelConfigSchema.parse(config);
  } catch (error) {
    console.error('Invalid tunnel configuration:', error);
    throw new Error('Invalid tunnel configuration');
  }
}

/**
 * Configuration presets for common scenarios
 */
export const TUNNEL_PRESETS = {
  // Vercel Edge deployment
  vercel: {
    transport: TunnelProvider.SUPABASE,
    fallbackChain: [
      TunnelProvider.SUPABASE,
      TunnelProvider.SSE,
      TunnelProvider.LONG_POLLING,
    ],
    optimization: {
      bundleMessages: true,
      compression: false,
      caching: true,
      prefetch: true,
    },
  },

  // Firebase hosting
  firebase: {
    transport: TunnelProvider.FIREBASE,
    fallbackChain: [
      TunnelProvider.FIREBASE,
      TunnelProvider.SUPABASE,
      TunnelProvider.SSE,
    ],
    optimization: {
      bundleMessages: true,
      compression: false,
      caching: true,
      prefetch: true,
    },
  },

  // Self-hosted with WebSocket
  selfHosted: {
    transport: TunnelProvider.WEBSOCKET,
    fallbackChain: [
      TunnelProvider.WEBSOCKET,
      TunnelProvider.SSE,
      TunnelProvider.LONG_POLLING,
    ],
    optimization: {
      bundleMessages: false,
      compression: true,
      caching: false,
      prefetch: false,
    },
  },

  // Private Kubernetes Cluster (PostgreSQL + WebSocket)
  'private-k8s-cluster': {
    transport: TunnelProvider.WEBSOCKET,
    fallbackChain: [
      TunnelProvider.WEBSOCKET,
      TunnelProvider.LONG_POLLING,
    ],
    optimization: {
      bundleMessages: true,
      compression: true,
      caching: true,
      prefetch: true,
    },
  },

  // Development
  development: {
    transport: TunnelProvider.WEBSOCKET,
    fallbackChain: [
      TunnelProvider.WEBSOCKET,
      TunnelProvider.SSE,
      TunnelProvider.LONG_POLLING,
    ],
    debug: true,
    optimization: {
      bundleMessages: false,
      compression: false,
      caching: false,
      prefetch: false,
    },
  },
} as const;

/**
 * Get preset configuration
 */
export function getPresetConfig(
  preset: keyof typeof TUNNEL_PRESETS
): TunnelConfig {
  // Fix: Convert readonly fallbackChain to mutable array for type compatibility
  const presetConfig = TUNNEL_PRESETS[preset];
  return {
    ...presetConfig,
    fallbackChain: Array.isArray(presetConfig.fallbackChain)
      ? [...presetConfig.fallbackChain]
      : [],
  };
}

/**
 * Export configuration singleton
 */
let _config: ValidatedTunnelConfig | null = null;

export function getTunnelConfig(): ValidatedTunnelConfig {
  if (!_config) {
    _config = createTunnelConfig();
  }
  return _config;
}

export function setTunnelConfig(config: Partial<TunnelConfig>): void {
  _config = createTunnelConfig(config);
}
