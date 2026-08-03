/**
 * Personal page section + field SSOT — shared by Page Builder and public /[username] RSC.
 */

export const PERSONAL_PAGE_SECTION_IDS = [
  'bio',
  'messengers',
  'professional',
  'location',
  'contact',
] as const

export type PersonalPageSectionId = (typeof PERSONAL_PAGE_SECTION_IDS)[number]

export const DEFAULT_PERSONAL_PAGE_SECTIONS: readonly PersonalPageSectionId[] = [
  ...PERSONAL_PAGE_SECTION_IDS,
]

/** Per-section field ids (v1). Missing key = visible when parent section is on. */
export const PERSONAL_PAGE_FIELDS = {
  bio: ['text'],
  messengers: ['telegram', 'whatsapp', 'viber', 'signal'],
  professional: ['organization', 'position', 'linkedin', 'twitter', 'skills'],
  location: ['country', 'timezone'],
  contact: ['phone'],
} as const satisfies Record<PersonalPageSectionId, readonly string[]>

export type PersonalPageFieldId =
  (typeof PERSONAL_PAGE_FIELDS)[PersonalPageSectionId][number]

export type PublicProfileFieldsMap = {
  [K in PersonalPageSectionId]?: Partial<
    Record<(typeof PERSONAL_PAGE_FIELDS)[K][number], boolean>
  >
}

export function normalizePersonalPageSections(
  raw?: string[] | null,
): PersonalPageSectionId[] {
  if (!raw?.length) return [...DEFAULT_PERSONAL_PAGE_SECTIONS]
  const allowed = new Set<string>(PERSONAL_PAGE_SECTION_IDS)
  const next = raw.filter((id): id is PersonalPageSectionId => allowed.has(id))
  return next.length ? next : [...DEFAULT_PERSONAL_PAGE_SECTIONS]
}

export function personalPageSectionEnabled(
  sections: string[] | null | undefined,
  id: PersonalPageSectionId,
): boolean {
  return normalizePersonalPageSections(sections).includes(id)
}

/**
 * Normalize publicProfileFields from JSONB / FormData.
 * Unknown sections/fields dropped; empty object is valid.
 */
export function normalizePublicProfileFields(
  raw?: unknown,
): PublicProfileFieldsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PublicProfileFieldsMap = {}
  for (const section of PERSONAL_PAGE_SECTION_IDS) {
    const bucket = (raw as Record<string, unknown>)[section]
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue
    const allowed = new Set<string>(PERSONAL_PAGE_FIELDS[section])
    const next: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(bucket as Record<string, unknown>)) {
      if (!allowed.has(key)) continue
      if (value === false || value === 'false' || value === 0 || value === '0') {
        next[key] = false
      } else if (value === true || value === 'true' || value === 1 || value === '1') {
        next[key] = true
      }
    }
    if (Object.keys(next).length) {
      out[section] = next as PublicProfileFieldsMap[typeof section]
    }
  }
  return out
}

/** Opt-out model: missing field key → visible when section enabled. */
export function personalPageFieldEnabled(
  fields: PublicProfileFieldsMap | null | undefined,
  section: PersonalPageSectionId,
  field: string,
): boolean {
  const bucket = fields?.[section] as Record<string, boolean> | undefined
  if (!bucket || !(field in bucket)) return true
  return bucket[field] !== false
}

/** Default true when unset — recipient accepts profile ContactForm / MessageUserButton. */
export function acceptsProfileDms(value: unknown): boolean {
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return true
}
