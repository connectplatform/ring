/**
 * LAYER1_STUB — community no-op. Full impl overlays from ring-platform-org / clone web/.
 */
import 'server-only'

export type CrmUserChip = {
  id: string
  name: string
  email?: string | null
  photoURL?: string | null
}

export async function resolveCrmUserChips(
  ids: string[],
): Promise<Record<string, CrmUserChip>> {
  const map: Record<string, CrmUserChip> = {}
  for (const id of [...new Set(ids.filter(Boolean))]) {
    map[id] = { id, name: id.slice(0, 8) }
  }
  return map
}
