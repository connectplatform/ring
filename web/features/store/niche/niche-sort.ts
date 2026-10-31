/**
 * L1 stub. Packs overwrite this module with vertical sort keys.
 * `null` from compareNicheSort means the store action keeps its own ordering.
 */

export type NicheSortOption = { value: string; labelKey: string }

export function getNicheSortOptions(): NicheSortOption[] | null {
  return null
}

/** Packs return a sort key when the saved value is not one of theirs. */
export function coerceNicheSort(sortBy: string): string {
  return sortBy
}

export function compareNicheSort(
  _a: { nicheData?: unknown; price?: string },
  _b: { nicheData?: unknown; price?: string },
  _sortBy: string,
): number | null {
  return null
}
