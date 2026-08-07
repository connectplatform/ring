import type { DatabaseDocument } from './interfaces/IDatabaseService';

/**
 * Normalize a single DB row from findById / read / create / update.
 * Handles both envelope shape `{ id, data: T }` and flat payloads.
 *
 * @deprecated Domain code should use `db().*Doc` methods; internal layer use only.
 */
export function unwrapDbDocument<T = Record<string, unknown>>(
  row: DatabaseDocument<Record<string, unknown>> | Record<string, unknown> | null | undefined
): T | null {
  if (row == null) {
    return null;
  }

  if (
    typeof row === 'object' &&
    'data' in row &&
    (row as DatabaseDocument<Record<string, unknown>>).data !== undefined
  ) {
    const envelope = row as DatabaseDocument<Record<string, unknown>>;
    return (envelope.data ?? envelope) as T;
  }

  return row as T;
}

/**
 * Normalize a query result row to a flat payload with a guaranteed `id`.
 *
 * @deprecated Domain code should use `db().*Doc` methods; internal layer use only.
 */
export function unwrapDbQueryRow<T extends object = Record<string, unknown>>(
  row: DatabaseDocument<Record<string, unknown>> | Record<string, unknown>
): T & { id: string } {
  const payload = unwrapDbDocument<T>(row);
  const id =
    (typeof row === 'object' && row !== null && 'id' in row ? String((row as { id?: unknown }).id) : '') ||
    (payload && typeof payload === 'object' && 'id' in payload
      ? String((payload as { id?: unknown }).id)
      : '');

  if (!payload || typeof payload !== 'object') {
    return { id } as T & { id: string };
  }

  return { ...payload, id };
}
