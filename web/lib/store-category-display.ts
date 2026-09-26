/**
 * Store category display — localize a category slug via the
 * `modules.store.categories.<slug>` locale registry (see
 * `locales/<locale>/modules/store.json`), falling back to a prettified slug.
 *
 * Client-safe: next-intl `useMessages()` returns the already-hydrated tree,
 * so lookup is deterministic (no MISSING_MESSAGE console noise for unknown
 * slugs) — clone `store.storeCategories` configs may add slugs whose keys are
 * not yet translated.
 */
import { useMessages } from 'next-intl'

type NestedMessages = Record<string, unknown>

/** "honey-boutique" → "Honey boutique" */
export function prettifyCategorySlug(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ')
}

function readPath(root: unknown, path: string[]): unknown {
  let node: unknown = root
  for (const key of path) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as NestedMessages)[key]
  }
  return node
}

/** Localize a store category slug; returns null when category is empty. */
export function localizeStoreCategory(
  messages: unknown,
  category: string | null | undefined,
): string | null {
  if (!category) return null
  const entry = readPath(messages, ['modules', 'store', 'categories', category])
  if (typeof entry === 'string' && entry.trim()) return entry
  return prettifyCategorySlug(category)
}

/** React hook variant for client components. */
export function useStoreCategoryName(
  category: string | null | undefined,
): string | null {
  const messages = useMessages()
  return localizeStoreCategory(messages, category)
}
