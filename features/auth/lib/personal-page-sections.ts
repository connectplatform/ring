/**
 * Personal page section + field + media SSOT — shared by Page Builder and public /[username] RSC.
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
  messengers: ['telegram', 'whatsapp'],
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

/** Media surfaces gated independently of master publicProfile when pinned. */
export const PERSONAL_PAGE_MEDIA_IDS = ['player', 'games', 'gallery'] as const

export type PersonalPageMediaId = (typeof PERSONAL_PAGE_MEDIA_IDS)[number]

export type PublicProfileMediaMap = Partial<Record<PersonalPageMediaId, boolean>>

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

/**
 * Normalize users.skills from JSONB (array, JSON string, or comma-separated).
 * Empty / unparseable → undefined (omit from AuthUser).
 */
export function normalizeSkills(raw: unknown): string[] | undefined {
  if (raw == null) return undefined
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) list = parsed
        else return undefined
      } catch {
        list = trimmed.split(',')
      }
    } else {
      list = trimmed.split(',')
    }
  } else {
    return undefined
  }
  const skills = [
    ...new Set(
      list
        .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
        .filter(Boolean),
    ),
  ]
  return skills.length ? skills : undefined
}

/** Default true when unset — recipient accepts profile ContactForm / MessageUserButton. */
export function acceptsProfileDms(value: unknown): boolean {
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return true
}

/** Default true when unset — NFT listings strip on public personal page. */
export function showNftListings(value: unknown): boolean {
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return true
}

/** Normalize publicProfileMedia map; unknown keys dropped. */
export function normalizePublicProfileMedia(raw?: unknown): PublicProfileMediaMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PublicProfileMediaMap = {}
  for (const id of PERSONAL_PAGE_MEDIA_IDS) {
    const value = (raw as Record<string, unknown>)[id]
    if (value === false || value === 'false' || value === 0 || value === '0') {
      out[id] = false
    } else if (value === true || value === 'true' || value === 1 || value === '1') {
      out[id] = true
    }
  }
  return out
}

/**
 * Media visibility: missing key inherits master `publicProfile`;
 * explicit true/false pins the surface independently.
 */
export function personalPageMediaVisible(
  media: PublicProfileMediaMap | null | undefined,
  surface: PersonalPageMediaId,
  masterPublicProfile: boolean,
): boolean {
  const pinned = media?.[surface]
  if (typeof pinned === 'boolean') return pinned
  return Boolean(masterPublicProfile)
}
