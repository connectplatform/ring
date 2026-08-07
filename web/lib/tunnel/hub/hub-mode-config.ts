/**
 * Tunnel Hub backend mode — mirrors DB_BACKEND_MODE pattern (env-driven, no JSON config file).
 *
 * memory: InMemoryTunnelHub (local dev).
 * k8s-postgres: InMemoryTunnelHub by default; optional Postgres LISTEN/NOTIFY fan-out when
 *   TUNNEL_POSTGRES_FANOUT=enabled (multi-replica publish path).
 * redis / connect: gated for multi-replica fan-out (not implemented yet).
 */

export type TunnelHubMode = 'memory' | 'k8s-postgres' | 'redis' | 'connect';

const VALID_MODES: TunnelHubMode[] = ['memory', 'k8s-postgres', 'redis', 'connect'];

/** Modes that start from an in-process registry (optionally wrapped by Postgres fan-out). */
export function usesInMemoryTunnelHub(mode: TunnelHubMode): boolean {
  return mode === 'memory' || mode === 'k8s-postgres';
}

/**
 * Additive gate for Postgres NOTIFY cross-pod fan-out.
 * Default disabled — zero overhead on single replica.
 */
export function isPostgresFanoutEnabled(): boolean {
  return process.env.TUNNEL_POSTGRES_FANOUT === 'enabled';
}

/**
 * Detect tunnel hub mode from TUNNEL_HUB_MODE.
 * Defaults to `memory` when unset (local dev). Production k8s sets `k8s-postgres`.
 */
export function detectTunnelHubMode(): TunnelHubMode {
  const raw = process.env.TUNNEL_HUB_MODE as TunnelHubMode | undefined;

  if (!raw) {
    return 'memory';
  }

  if (!VALID_MODES.includes(raw)) {
    throw new Error(
      `Invalid TUNNEL_HUB_MODE: ${raw}. Must be one of: ${VALID_MODES.join(', ')}`,
    );
  }

  return raw;
}

export function getTunnelHubModeDescription(mode: TunnelHubMode): string {
  switch (mode) {
    case 'memory':
      return 'In-process hub (default; local dev)';
    case 'k8s-postgres':
      return isPostgresFanoutEnabled()
        ? 'k8s: InMemoryTunnelHub + Postgres LISTEN/NOTIFY cross-pod fan-out'
        : 'k8s: in-process fan-out (set TUNNEL_POSTGRES_FANOUT=enabled for multi-replica)';
    case 'redis':
      return 'Redis pub/sub hub (multi-replica; not implemented)';
    case 'connect':
      return 'ConnectPlatform hub (multi-replica; not implemented)';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
