/**
 * Stable-enough instance id for LISTEN self-echo skip.
 * Override with TUNNEL_INSTANCE_ID in tests.
 */

export function getTunnelInstanceId(): string {
  const override = process.env.TUNNEL_INSTANCE_ID?.trim();
  if (override) return override;
  const host = process.env.HOSTNAME ?? 'local';
  return `${host}:${process.pid}`;
}
