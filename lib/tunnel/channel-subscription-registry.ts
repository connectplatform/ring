/**
 * SSOT for deduplicated tunnel channel subscriptions.
 * One transport subscribe per channel; many handler registrations share it.
 * Prevents duplicate in-flight subscribe calls when handlers race on the same channel.
 *
 * Removed deprecated hooks (2026-06-22): useTunnelNotifications, useTunnelMessages,
 * useTunnelPresence — see lib/tunnel/SUBSCRIPTION-SSOT.md for removal report.
 *
 * BACKLOG (documented in docs/en/features/tunnel-protocol.mdx FutureFeatureBacklog):
 * - TUNNEL_HUB_MODE=redis|connect for multi-replica hub fan-out
 * - Postgres LISTEN/NOTIFY bridge for k8s-postgres mode (replace in-process-only fan-out)
 * - Subscribe/unsubscribe telemetry endpoint for ops (duplicate /api/tunnel/subscribe detection)
 * - Optional: migrate useSync tunnel leg fully to useTunnelChannel
 */

import type { TunnelMessage, TunnelSubscription } from '@/lib/tunnel/types'

export type TunnelTransportSubscribe = (options: {
  channel: string
}) => Promise<TunnelSubscription>

export interface ChannelSubscriptionRegistryOptions {
  subscribeTransport: TunnelTransportSubscribe
  debug?: boolean
  onError?: (error: Error, channel: string) => void
}

export interface ChannelSubscriptionRegistry {
  subscribe: (channel: string, handler: (message: TunnelMessage) => void) => () => void
  dispatch: (channel: string, message: TunnelMessage) => void
  clearAll: () => void
}

export function createChannelSubscriptionRegistry(
  options: ChannelSubscriptionRegistryOptions,
): ChannelSubscriptionRegistry {
  const handlers = new Map<string, Map<symbol, (message: TunnelMessage) => void>>()
  const channelSubscriptions = new Map<string, TunnelSubscription>()
  const pendingSubscribes = new Map<string, Promise<TunnelSubscription>>()

  const hasActiveOrPendingSubscription = (channel: string) =>
    channelSubscriptions.has(channel) || pendingSubscribes.has(channel)

  const subscribe = (channel: string, handler: (message: TunnelMessage) => void): (() => void) => {
    const handlerKey = Symbol('handler')

    if (!handlers.has(channel)) {
      handlers.set(channel, new Map())
    }
    handlers.get(channel)!.set(handlerKey, handler)

    if (!hasActiveOrPendingSubscription(channel)) {
      if (options.debug) {
        console.log(`[ChannelSubscriptionRegistry] Creating transport subscription: ${channel}`)
      }

      const promise = options.subscribeTransport({ channel })
      pendingSubscribes.set(channel, promise)

      void promise
        .then((subscription) => {
          pendingSubscribes.delete(channel)
          const channelHandlers = handlers.get(channel)
          if (channelHandlers && channelHandlers.size > 0) {
            channelSubscriptions.set(channel, subscription)
          } else {
            subscription.unsubscribe()
          }
        })
        .catch((err) => {
          pendingSubscribes.delete(channel)
          const error = err instanceof Error ? err : new Error(String(err))
          options.onError?.(error, channel)
        })
    } else if (options.debug) {
      console.log(`[ChannelSubscriptionRegistry] Reusing transport subscription: ${channel}`)
    }

    return () => {
      const channelHandlers = handlers.get(channel)
      if (!channelHandlers) {
        return
      }

      channelHandlers.delete(handlerKey)

      if (channelHandlers.size === 0) {
        handlers.delete(channel)

        const subscription = channelSubscriptions.get(channel)
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe()
        }
        channelSubscriptions.delete(channel)
      }
    }
  }

  const dispatch = (channel: string, message: TunnelMessage) => {
    const channelHandlers = handlers.get(channel)
    if (!channelHandlers) {
      return
    }
    channelHandlers.forEach((handler) => handler(message))
  }

  const clearAll = () => {
    for (const subscription of channelSubscriptions.values()) {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe()
      }
    }
    handlers.clear()
    channelSubscriptions.clear()
    pendingSubscribes.clear()
  }

  return { subscribe, dispatch, clearAll }
}
