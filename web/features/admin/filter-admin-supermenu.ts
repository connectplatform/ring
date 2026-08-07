import type { SupermenuEntry, SupermenuGroup } from '@/features/admin/build-admin-supermenu'

/** Filter supermenu groups by leaf/heading/title label match (case-insensitive). */
export function filterSupermenuGroups(
  groups: SupermenuGroup[],
  query: string,
): SupermenuGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups

  return groups
    .map((group) => {
      const titleMatch = group.title.toLowerCase().includes(q)
      if (titleMatch) return group

      const entries: SupermenuEntry[] = []
      let pendingHeading: Extract<SupermenuEntry, { kind: 'heading' }> | null = null

      for (const entry of group.entries) {
        if (entry.kind === 'heading') {
          pendingHeading = entry
          continue
        }
        if (entry.label.toLowerCase().includes(q)) {
          if (pendingHeading) {
            entries.push(pendingHeading)
            pendingHeading = null
          }
          entries.push(entry)
        }
      }

      if (entries.length === 0) return null
      return { ...group, entries }
    })
    .filter((g): g is SupermenuGroup => g !== null)
}
