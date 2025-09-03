'use client'

// Minimal event bus for cross-hook communication in the browser.
// Avoids introducing heavy dependencies and supports typed payloads.

type EventMap = {
  'wallet:balance:refresh': { reason: string; address?: string | null };
  'wallet:connected': { address: string | null };
  'wallet:disconnected': { };
};

type EventKey = keyof EventMap;
type EventListener<K extends EventKey> = (payload: EventMap[K]) => void;

class SimpleEventBus {
  private listeners: { [K in EventKey]?: Set<EventListener<K>> } = {};

  on<K extends EventKey>(event: K, listener: EventListener<K>): () => void {
    const set = (this.listeners[event] as Set<EventListener<K>>) || new Set<EventListener<K>>();
    set.add(listener);
    this.listeners[event] = set as any;
    return () => this.off(event, listener);
  }

  off<K extends EventKey>(event: K, listener: EventListener<K>): void {
    const set = this.listeners[event] as Set<EventListener<K>> | undefined;
    if (set) set.delete(listener);
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    const set = this.listeners[event] as Set<EventListener<K>> | undefined;
    if (!set || set.size === 0) return;
    set.forEach((listener) => {
      try {
        listener(payload);
      } catch (e) {
        // Swallow listener errors to avoid breaking other subscribers
        console.error(`[event-bus] listener error for ${String(event)}:`, e);
      }
    });
  }
}

export const eventBus = new SimpleEventBus();
