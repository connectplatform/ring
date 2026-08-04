/**
 * Shared exponential reconnect delay — used by NativeWsClient, SSETransport,
 * and aligned with Postgres fan-out LISTEN reconnect math.
 */

export const TUNNEL_RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * @param attempt 1-based reconnect attempt number
 * @param baseMs initial delay (attempt 1)
 * @param maxMs hard cap (default 30s)
 */
export function computeReconnectDelay(
  attempt: number,
  baseMs: number,
  maxMs: number = TUNNEL_RECONNECT_MAX_DELAY_MS,
): number {
  const safeAttempt = Math.max(1, attempt);
  return Math.min(baseMs * 2 ** (safeAttempt - 1), maxMs);
}
