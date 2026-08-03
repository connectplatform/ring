import 'server-only'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getEnvKeyOwner,
  isBrandMirrorEnvKey,
  type EnvKeyOwner,
} from '@/features/crm/lab/env-key-ownership'

export type EnvKeyClass = 'public' | 'secret'
export type { EnvKeyOwner }

export interface EnvTemplateKey {
  key: string
  class: EnvKeyClass
  owner: EnvKeyOwner
  /** Raw comment lines above the key in the template */
  comment?: string
  /** Default / example value from template (may be empty) */
  example?: string
  /** True if the template line was commented out (# KEY=) */
  optional: boolean
}

export interface EnvTemplateGroup {
  id: string
  title: string
  keys: EnvTemplateKey[]
}

export interface EnvTemplateManifest {
  groups: EnvTemplateGroup[]
  /** Flat allowlist of all known keys */
  allowlist: Set<string>
  /** Clone essentials pinned at top of UI */
  essentials: string[]
}

const ESSENTIALS = [
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
  'BLOB_READ_WRITE_TOKEN',
  'NEXT_PUBLIC_STORAGE_PROVIDER',
  'RINGBASE_API_URL',
  'RINGBASE_PUBLIC_URL',
  'RINGBASE_API_TOKEN',
  'AUTH_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DATABASE_URL',
] as const

const BANNER_RE = /^#\s*={10,}\s*$/
const SUBSECTION_RE = /^#\s*---\s*(.+?)\s*---\s*$/
const KEY_RE = /^(#\s*)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'section'
}

function classifyKey(key: string): EnvKeyClass {
  return key.startsWith('NEXT_PUBLIC_') ? 'public' : 'secret'
}

/**
 * Parse env.local.template into grouped manifest.
 * Sections: `# ====…` banners (77 equals). Subsections: `# --- Title ---`.
 */
export function parseEnvTemplate(raw: string): EnvTemplateManifest {
  const lines = raw.split(/\r?\n/)
  const groups: EnvTemplateGroup[] = []
  let current: EnvTemplateGroup | null = null
  let pendingComments: string[] = []
  let i = 0

  const ensureGroup = (title: string) => {
    const id = slugify(title)
    current = { id, title, keys: [] }
    groups.push(current)
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (BANNER_RE.test(trimmed)) {
      // Expect title on next line, then closing banner
      const titleLine = lines[i + 1]?.trim() ?? ''
      const closeLine = lines[i + 2]?.trim() ?? ''
      if (titleLine.startsWith('#') && BANNER_RE.test(closeLine)) {
        const title = titleLine.replace(/^#\s*/, '').replace(/^[^\w]+/, '').trim() || 'Section'
        ensureGroup(title)
        pendingComments = []
        i += 3
        continue
      }
    }

    const sub = trimmed.match(SUBSECTION_RE)
    if (sub) {
      ensureGroup(sub[1].trim())
      pendingComments = []
      i += 1
      continue
    }

    if (trimmed.startsWith('#') && !trimmed.includes('=')) {
      pendingComments.push(trimmed.replace(/^#\s?/, ''))
      i += 1
      continue
    }

    const keyMatch = trimmed.match(KEY_RE)
    if (keyMatch && current) {
      const optional = Boolean(keyMatch[1])
      const key = keyMatch[2]
      const example = keyMatch[3] ?? ''
      // Skip duplicates within group
      if (!current.keys.some((k) => k.key === key) && !isBrandMirrorEnvKey(key)) {
        current.keys.push({
          key,
          class: classifyKey(key),
          owner: getEnvKeyOwner(key),
          comment: pendingComments.length ? pendingComments.join('\n') : undefined,
          example: example || undefined,
          optional,
        })
      }
      pendingComments = []
      i += 1
      continue
    }

    if (!trimmed) pendingComments = []
    i += 1
  }

  // Drop empty groups
  const nonEmpty = groups.filter((g) => g.keys.length > 0)
  const allowlist = new Set<string>()
  for (const g of nonEmpty) {
    for (const k of g.keys) allowlist.add(k.key)
  }
  // Essentials always allowlisted even if missing from template
  for (const k of ESSENTIALS) allowlist.add(k)

  return {
    groups: nonEmpty,
    allowlist,
    essentials: [...ESSENTIALS],
  }
}

let cachedManifest: EnvTemplateManifest | null = null

export function getEnvTemplateManifest(forceReload = false): EnvTemplateManifest {
  if (cachedManifest && !forceReload) return cachedManifest
  const path = join(process.cwd(), 'env.local.template')
  const raw = readFileSync(path, 'utf8')
  cachedManifest = parseEnvTemplate(raw)
  return cachedManifest
}

export function isAllowedEnvKey(key: string): boolean {
  return getEnvTemplateManifest().allowlist.has(key)
}
