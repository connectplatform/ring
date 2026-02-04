/**
 * Tunnel Transport Manager
 * Central manager for transport selection, fallback chain, and connection state
 */

import {
  TunnelTransport,
  TunnelProvider,
  TunnelConnectionState,
  TunnelConnectionOptions,
  TunnelConfig,
  TunnelHealth,
  TunnelMessage,
  TunnelSubscription,
  TunnelSubscriptionOptions,
  TunnelEventHandler,
} from './types';
import {
  getTunnelConfig,
  detectEnvironment,
  detectProviderCredentials,
  getProviderConnectionOptions,
} from './config';
/**
 * Transport factory registry - LAZY LOADED for optimal bundle size
 * Only loads transport implementations when actually needed
 */
const transportFactories: Record<TunnelProvider, (options?: TunnelConnectionOptions) => Promise<TunnelTransport | null>> = {
  [TunnelProvider.WEBSOCKET]: async (options) => {
    try {
      const { createWebSocketTransport } = await import('./transports/websocket-transport');
      return createWebSocketTransport(options);
    } catch (error) {
      console.warn('WebSocket transport not available:', error);
      return null;
    }
  },
  [TunnelProvider.SSE]: async (options) => {
    try {
      const { createSSETransport } = await import('./transports/sse-transport');
      return createSSETransport(options);
    } catch (error) {
      console.warn('SSE transport not available:', error);
      return null;
    }
  },
  [TunnelProvider.SUPABASE]: async (options) => {
    try {
      const { createSupabaseTransport } = await import('./transports/supabase-transport');
      return createSupabaseTransport(options);
    } catch (error) {
      console.warn('Supabase transport not available:', error);
      return null;
    }
  },
  [TunnelProvider.LONG_POLLING]: async (options) => {
    try {
      const { createPollingTransport } = await import('./transports/polling-transport');
      return createPollingTransport(options);
    } catch (error) {
      console.warn('Long-polling transport not available:', error);
      return null;
    }
  },
  [TunnelProvider.FIREBASE]: async () => {
    console.warn('Firebase transport not yet implemented');
    return null;
  },
  [TunnelProvider.FIREBASE_EDGE]: async () => {
    console.warn('Firebase Edge transport not yet implemented');
    return null;
  },
  [TunnelProvider.PUSHER]: async () => {
    console.warn('Pusher transport not yet implemented');
    return null;
  },
  [TunnelProvider.ABLY]: async () => {
    console.warn('Ably transport not yet implemented');
    return null;
  },
};

/**
 * Tunnel Transport Manager
 * Manages transport selection, fallback, and health monitoring
 */
export class TunnelTransportManager implements TunnelTransport {
  private config: TunnelConfig;
  private currentTransport: TunnelTransport | null = null;
  private currentProvider: TunnelProvider | null = null;
  private fallbackChain: TunnelProvider[] = [];
  private fallbackIndex = 0;
  private eventHandlers = new Map<string, Set<TunnelEventHandler>>();
  private subscriptions = new Map<string, TunnelSubscription>();
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private isConnecting = false;
  private debug = false;
  // Adaptive health checking
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private currentHealthInterval = 30000; // Start with default

  constructor(config?: Partial<TunnelConfig>) {
    const baseConfig = getTunnelConfig();
    // Ensure transport is always defined
    this.config = {
      ...baseConfig,
      ...config,
      transport: config?.transport || baseConfig.transport || 'auto',
    } as TunnelConfig;
    this.debug = this.config.debug || false;
    
    // Build fallback chain
    this.buildFallbackChain();
    
    // Start health monitoring if enabled
    if (this.config.healthCheck?.enabled) {
      this.startHealthMonitoring();
    }

    // Initialize adaptive health interval
    if (this.config.healthCheck?.adaptive) {
      this.currentHealthInterval = this.config.healthCheck.interval || 30000;
    }

    this.log('Transport Manager initialized', {
      primary: this.config.transport,
      fallbackChain: this.fallbackChain,
      environment: detectEnvironment(),
    });
  }

  private buildFallbackChain(): void {
    const availableProviders = detectProviderCredentials();
    
    // Start with configured transport
    if (this.config.transport !== 'auto' && availableProviders.has(this.config.transport as TunnelProvider)) {
      this.fallbackChain.push(this.config.transport as TunnelProvider);
    }

    // Add configured fallback chain
    if (this.config.fallbackChain) {
      for (const provider of this.config.fallbackChain) {
        if (!this.fallbackChain.includes(provider) && availableProviders.has(provider)) {
          this.fallbackChain.push(provider);
        }
      }
    }

    // Ensure at least SSE as ultimate fallback
    if (!this.fallbackChain.includes(TunnelProvider.SSE)) {
      this.fallbackChain.push(TunnelProvider.SSE);
    }

    this.log('Fallback chain built', { chain: this.fallbackChain });
  }

  async connect(options?: TunnelConnectionOptions): Promise<void> {
    if (this.isConnecting) {
      this.log('Already connecting, skipping duplicate connect call');
      return;
    }

    if (this.currentTransport?.isConnected()) {
      this.log('Already connected');
      return;
    }

    this.isConnecting = true;
    this.connectionAttempts = 0;

    try {
      await this.connectWithFallback(options);
    } finally {
      this.isConnecting = false;
    }
  }

  private async connectWithFallback(options?: TunnelConnectionOptions): Promise<void> {
    while (this.fallbackIndex < this.fallbackChain.length) {
      const provider = this.fallbackChain[this.fallbackIndex];
      
      this.log(`Attempting connection with ${provider}`);
      
      try {
        await this.connectToProvider(provider, options);
        
        // Success!
        this.connectionAttempts = 0;
        this.emit('connect', undefined);
        
        this.log(`Successfully connected with ${provider}`);
        return;
      } catch (error) {
        this.log(`Failed to connect with ${provider}:`, error);
        
        // Try next provider in fallback chain
        this.fallbackIndex++;
        
        if (this.fallbackIndex < this.fallbackChain.length) {
          const nextProvider = this.fallbackChain[this.fallbackIndex];
          this.emit('transport:fallback', { current: provider, next: nextProvider });
        }
      }
    }

    // All providers failed
    this.fallbackIndex = 0; // Reset for next attempt
    throw new Error('All transport providers failed to connect');
  }

  private async connectToProvider(provider: TunnelProvider, options?: TunnelConnectionOptions): Promise<void> {
    // Clean up previous transport if any
    if (this.currentTransport) {
      await this.cleanupCurrentTransport();
    }

    // Create transport instance (now async with lazy loading)
    const factory = transportFactories[provider];
    if (!factory) {
      throw new Error(`No factory for provider: ${provider}`);
    }

    const providerOptions = {
      ...getProviderConnectionOptions(provider),
      ...options,
    };

    const transport = await factory(providerOptions);
    if (!transport) {
      throw new Error(`Failed to create transport for: ${provider}`);
    }

    // Set up event forwarding before connecting
    this.setupEventForwarding(transport);

    // Attempt connection
    await transport.connect(providerOptions);

    // Verify connection
    if (!transport.isConnected()) {
      throw new Error(`Transport connected but not in connected state: ${provider}`);
    }

    // Success - save transport
    const previousProvider = this.currentProvider;
    this.currentTransport = transport;
    this.currentProvider = provider;

    // Restore subscriptions
    await this.restoreSubscriptions();

    // Emit transport switch event if provider changed
    if (previousProvider && previousProvider !== provider) {
      this.emit('transport:switch', { from: previousProvider, to: provider });
    }
  }

  private async cleanupCurrentTransport(): Promise<void> {
    if (!this.currentTransport) return;

    try {
      // Remove event forwarding
      this.removeEventForwarding(this.currentTransport);
      
      // Disconnect
      await this.currentTransport.disconnect();
    } catch (error) {
      this.log('Error cleaning up transport:', error);
    }

    this.currentTransport = null;
    this.currentProvider = null;
  }

  private setupEventForwarding(transport: TunnelTransport): void {
    // Forward all events from transport to manager
    const events = ['connect', 'disconnect', 'reconnect', 'error', 'message', 'notification', 'presence', 'health', 'latency'];
    
    for (const event of events) {
      transport.on(event, (data: any) => {
        this.emit(event, data);
      });
    }

    // Handle disconnect for automatic fallback
    transport.on('disconnect', async (data: any) => {
      this.log('Transport disconnected:', data);
      
      if (this.config.retry?.enabled && this.connectionAttempts < this.maxConnectionAttempts) {
        this.connectionAttempts++;
        
        // Try to reconnect with same provider first
        try {
          await this.connectToProvider(this.currentProvider!, this.config.connection);
        } catch (error) {
          // Try next in fallback chain
          this.fallbackIndex++;
          if (this.fallbackIndex < this.fallbackChain.length) {
            await this.connectWithFallback(this.config.connection);
          }
        }
      }
    });
  }

  private removeEventForwarding(transport: TunnelTransport): void {
    // Remove all event listeners
    const events = ['connect', 'disconnect', 'reconnect', 'error', 'message', 'notification', 'presence', 'health', 'latency'];
    
    for (const event of events) {
      transport.off(event);
    }
  }

  private async restoreSubscriptions(): Promise<void> {
    if (!this.currentTransport) return;

    const subscriptionPromises: Promise<void>[] = [];

    for (const [id, subscription] of this.subscriptions) {
      const promise = this.currentTransport
        .subscribe({
          channel: subscription.channel,
          // TODO: Store and restore original subscription options
        })
        .then(newSub => {
          // Update subscription reference
          this.subscriptions.set(id, newSub);
        })
        .catch(error => {
          this.log(`Failed to restore subscription ${id}:`, error);
        });

      subscriptionPromises.push(promise);
    }

    await Promise.all(subscriptionPromises);
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const performHealthCheck = async () => {
      if (!this.currentTransport || !this.currentTransport.isConnected()) {
        return;
      }

      try {
        const health = this.currentTransport.getHealth();
        this.emit('health', health);

        // Adaptive health checking logic
        if (this.config.healthCheck?.adaptive) {
          this.adjustHealthCheckInterval(health);
        }

        // Check if transport is unhealthy
        const failureThreshold = this.config.healthCheck?.failureThreshold || 3;
        if (health.state === TunnelConnectionState.ERROR || health.errors > failureThreshold) {
          this.consecutiveFailures++;
          this.consecutiveSuccesses = 0;

          this.log('Transport unhealthy, attempting fallback');

          // Try next provider
          this.fallbackIndex++;
          if (this.fallbackIndex < this.fallbackChain.length) {
            await this.connectWithFallback(this.config.connection);
          }
        } else {
          // Connection is healthy
          this.consecutiveSuccesses++;
          this.consecutiveFailures = 0;
        }
      } catch (error) {
        this.log('Health check failed:', error);
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
      }
    };

    // Initial health check
    performHealthCheck();

    // Set up recurring health checks with adaptive interval
    this.scheduleNextHealthCheck(performHealthCheck);
  }

  private adjustHealthCheckInterval(health: TunnelHealth): void {
    const config = this.config.healthCheck!;
    const minInterval = config.minInterval || 15000;
    const maxInterval = config.maxInterval || 120000;

    // Adjust interval based on connection stability
    if (this.consecutiveFailures >= 2) {
      // Unstable connection - check more frequently
      this.currentHealthInterval = Math.max(minInterval, this.currentHealthInterval * 0.8);
    } else if (this.consecutiveSuccesses >= 5) {
      // Stable connection - check less frequently
      this.currentHealthInterval = Math.min(maxInterval, this.currentHealthInterval * 1.2);
    }

    this.log(`Adaptive health check: ${this.currentHealthInterval}ms (failures: ${this.consecutiveFailures}, successes: ${this.consecutiveSuccesses})`);
  }

  private scheduleNextHealthCheck(performHealthCheck: () => Promise<void>): void {
    this.healthCheckTimer = setTimeout(async () => {
      await performHealthCheck();
      this.scheduleNextHealthCheck(performHealthCheck);
    }, this.currentHealthInterval);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthMonitoring();
    
    if (this.currentTransport) {
      await this.cleanupCurrentTransport();
    }

    this.subscriptions.clear();
    this.fallbackIndex = 0;
    this.connectionAttempts = 0;
    
    this.emit('disconnect', { reason: 'Manual disconnect' });
  }

  isConnected(): boolean {
    return this.currentTransport?.isConnected() || false;
  }

  getConnectionState(): TunnelConnectionState {
    return this.currentTransport?.getConnectionState() || TunnelConnectionState.DISCONNECTED;
  }

  async publish(channel: string, event: string, data: any): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('Not connected');
    }
    return this.currentTransport.publish(channel, event, data);
  }

  async subscribe(options: TunnelSubscriptionOptions): Promise<TunnelSubscription> {
    if (!this.currentTransport) {
      throw new Error('Not connected');
    }

    const subscription = await this.currentTransport.subscribe(options);
    this.subscriptions.set(subscription.id, subscription);
    
    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('Not connected');
    }

    await this.currentTransport.unsubscribe(subscriptionId);
    this.subscriptions.delete(subscriptionId);
  }

  on(event: string, handler: TunnelEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler?: TunnelEventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    }
  }

  once(event: string, handler: TunnelEventHandler): void {
    const onceHandler: TunnelEventHandler = (message) => {
      handler(message);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  getHealth(): TunnelHealth {
    if (!this.currentTransport) {
      return {
        state: TunnelConnectionState.DISCONNECTED,
        latency: -1,
        uptime: 0,
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0,
        lastActivity: Date.now(),
        provider: TunnelProvider.WEBSOCKET,
      };
    }

    const health = this.currentTransport.getHealth();
    
    // Add manager-specific info
    return {
      ...health,
      providerSpecific: {
        ...health.providerSpecific,
        currentProvider: this.currentProvider,
        fallbackChain: this.fallbackChain,
        fallbackIndex: this.fallbackIndex,
        connectionAttempts: this.connectionAttempts,
      },
    };
  }

  async getLatency(): Promise<number> {
    if (!this.currentTransport) {
      return -1;
    }
    return this.currentTransport.getLatency();
  }

  getProvider(): TunnelProvider {
    return this.currentProvider || TunnelProvider.WEBSOCKET;
  }

  getProviderClient(): any {
    return this.currentTransport?.getProviderClient?.();
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
    this.currentTransport?.setDebug?.(enabled);
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[TunnelTransportManager] ${message}`, data || '');
    }

    if (this.config.logger) {
      this.config.logger('info', message, data);
    }
  }

  /**
   * Get current transport for direct access (advanced usage)
   */
  getCurrentTransport(): TunnelTransport | null {
    return this.currentTransport;
  }

  /**
   * Force switch to a specific provider
   */
  async switchProvider(provider: TunnelProvider): Promise<void> {
    this.log(`Force switching to ${provider}`);
    
    // Find provider in fallback chain
    const index = this.fallbackChain.indexOf(provider);
    if (index === -1) {
      throw new Error(`Provider ${provider} not available in fallback chain`);
    }

    this.fallbackIndex = index;
    await this.connectToProvider(provider, this.config.connection);
  }

  /**
   * Get available providers based on environment
   */
  getAvailableProviders(): TunnelProvider[] {
    return Array.from(detectProviderCredentials());
  }

  // PHASE 1: User-specific publishing methods for server push
  isUserConnected(userId: string): boolean {
    // Check if user has an active connection
    // This is a simplified implementation - in production this would track active connections
    return this.currentTransport !== null && this.getConnectionState() === TunnelConnectionState.CONNECTED;
  }

  async publishToUser(userId: string, channel: string, message: TunnelMessage): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('No active transport connection');
    }

    // For server-side publishing, we need to send to specific user
    // This implementation assumes the transport can handle user-specific routing
    await this.currentTransport.publish(`${userId}:${channel}`, message.type, message);
  }

  async broadcast(channel: string, message: TunnelMessage, excludeUserId?: string): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('No active transport connection');
    }

    await this.currentTransport.publish(channel, message.type, {
      ...message,
      excludeUserId
    });
  }
}

/**
 * Singleton instance
 */
let managerInstance: TunnelTransportManager | null = null;

/**
 * Get or create singleton transport manager
 */
export function getTunnelTransportManager(config?: Partial<TunnelConfig>): TunnelTransportManager {
  if (!managerInstance) {
    managerInstance = new TunnelTransportManager(config);
  }
  return managerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetTunnelTransportManager(): void {
  if (managerInstance) {
    managerInstance.disconnect();
    managerInstance = null;
  }
}
