/**
 * Throttle Y.js awareness updates to reduce WS traffic.
 */

export function createAwarenessThrottle(intervalMs = 50) {
  let lastSent = 0;
  let pending: Uint8Array | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sendFn: ((data: Uint8Array) => void) | null = null;

  const flush = () => {
    timer = null;
    if (!pending || !sendFn) return;
    const data = pending;
    pending = null;
    lastSent = Date.now();
    sendFn(data);
  };

  return {
    setSender(fn: (data: Uint8Array) => void) {
      sendFn = fn;
    },
    push(update: Uint8Array) {
      pending = update;
      const now = Date.now();
      const elapsed = now - lastSent;
      if (elapsed >= intervalMs) {
        flush();
        return;
      }
      if (!timer) {
        timer = setTimeout(flush, intervalMs - elapsed);
      }
    },
    destroy() {
      if (timer) clearTimeout(timer);
      pending = null;
      sendFn = null;
    },
  };
}
