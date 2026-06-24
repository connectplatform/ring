/** Docs sidebar audience filter — founders (operators) vs developers (integrators). */

export type DocsAudience = 'founder' | 'developer'

export const DOCS_AUDIENCE_STORAGE_KEY = 'ring-docs-audience'

/** MDX `<Audience for="…">` — `both` renders under either tab. */
export type DocsAudienceTarget = DocsAudience | 'both'

export const DEFAULT_DOCS_AUDIENCE: DocsAudience = 'founder'

export function isDocsAudience(value: string | null | undefined): value is DocsAudience {
  return value === 'founder' || value === 'developer'
}

export function audienceBlockVisible(
  active: DocsAudience,
  target: DocsAudienceTarget,
): boolean {
  return target === 'both' || target === active
}

/** Reserved for reader-mode / text-size prefs alongside audience filter. */
export interface DocsReaderPrefs {
  textScale?: 'sm' | 'base' | 'lg' | 'xl'
  readerMode?: boolean
}

export const DOCS_READER_PREFS_STORAGE_KEY = 'ring-docs-reader-prefs'
