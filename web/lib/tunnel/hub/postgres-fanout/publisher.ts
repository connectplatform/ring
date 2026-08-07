/**
 * NOTIFY publisher — safe to run on a short-lived Pool/Client query.
 * Never use the dedicated LISTEN connection for app queries.
 */

import type { Pool } from 'pg';
import {
  getTunnelNotifyChannel,
  serializeTunnelFanoutEnvelope,
  type TunnelFanoutEnvelope,
} from './envelope';

export type NotifyQueryFn = (text: string, values?: unknown[]) => Promise<unknown>;

export async function notifyTunnelFanout(
  query: NotifyQueryFn | Pick<Pool, 'query'>,
  envelope: TunnelFanoutEnvelope,
  channel: string = getTunnelNotifyChannel(),
): Promise<void> {
  const payload = serializeTunnelFanoutEnvelope(envelope);
  const run = typeof query === 'function' ? query : query.query.bind(query);
  await run('SELECT pg_notify($1, $2)', [channel, payload]);
}
