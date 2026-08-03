/**
 * Connection config for tunnel fan-out LISTEN Client / NOTIFY queries.
 * Prefers DATABASE_URL; falls back to DB_* (same env surface as k8s secrets).
 */

import type { ClientConfig } from 'pg';

export function getTunnelFanoutPgConfig(): ClientConfig {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return { connectionString: url };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'ring_platform',
    user: process.env.DB_USER || 'ring_user',
    password: process.env.DB_PASSWORD || 'ring_dev_password',
  };
}
