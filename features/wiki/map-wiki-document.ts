import type { WikiEvent, WikiLink, WikiPage, WikiPageKind, VaultKey } from '@/features/wiki/types'
import { isVaultKey, normalizePath } from '@/features/wiki/vault-key'

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((x): x is string => typeof x === 'string')
}

const KINDS = new Set<WikiPageKind>([
  'page',
  'schema',
  'entity',
  'concept',
  'source',
  'synthesis',
])

export function mapWikiPage(
  row: { id: string; data?: Record<string, unknown> } & Record<string, unknown>,
): WikiPage {
  const d = (row.data ?? row) as Record<string, unknown>
  const vaultRaw = asString(d.vaultKey, 'tenant')
  const vaultKey: VaultKey = isVaultKey(vaultRaw) ? vaultRaw : 'tenant'
  const kindRaw = asString(d.kind, 'page') as WikiPageKind
  const kind = KINDS.has(kindRaw) ? kindRaw : 'page'
  const fm = (d.frontmatter && typeof d.frontmatter === 'object'
    ? (d.frontmatter as Record<string, unknown>)
    : {}) as Record<string, unknown>

  return {
    id: row.id,
    title: asString(d.title),
    slug: asString(d.slug),
    path: normalizePath(asString(d.path)),
    bodyMarkdown: asString(d.bodyMarkdown),
    vaultKey,
    kind,
    frontmatter: {
      tags: asStringArray(fm.tags),
      aliases: asStringArray(fm.aliases),
      status:
        fm.status === 'draft' || fm.status === 'published' || fm.status === 'archived'
          ? fm.status
          : 'published',
      sources: asStringArray(fm.sources),
      schemaLinksVersion: (() => {
        const v = fm.schemaLinksVersion
        if (typeof v === 'number' && Number.isFinite(v)) return v
        if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
        return undefined
      })(),
    },
    createdBy: asString(d.createdBy),
    updatedBy: asString(d.updatedBy),
    createdAt: asString(d.createdAt) || new Date().toISOString(),
    updatedAt: asString(d.updatedAt) || new Date().toISOString(),
  }
}

export function mapWikiLink(
  row: { id: string; data?: Record<string, unknown> } & Record<string, unknown>,
): WikiLink {
  const d = (row.data ?? row) as Record<string, unknown>
  const toVaultRaw = asString(d.toVaultKey, 'tenant')
  return {
    id: row.id,
    fromId: asString(d.fromId),
    toVaultKey: isVaultKey(toVaultRaw) ? toVaultRaw : 'tenant',
    toSlug: asString(d.toSlug),
    toId: d.toId == null || d.toId === '' ? null : asString(d.toId),
    linkKind: d.linkKind === 'tenant_ref' ? 'tenant_ref' : 'local',
    rawText: asString(d.rawText),
    createdAt: asString(d.createdAt) || new Date().toISOString(),
  }
}

export function mapWikiEvent(
  row: { id: string; data?: Record<string, unknown> } & Record<string, unknown>,
): WikiEvent {
  const d = (row.data ?? row) as Record<string, unknown>
  const vaultRaw = asString(d.vaultKey, 'tenant')
  return {
    id: row.id,
    vaultKey: isVaultKey(vaultRaw) ? vaultRaw : 'tenant',
    at: asString(d.at) || new Date().toISOString(),
    actorId: asString(d.actorId),
    actorRole: asString(d.actorRole),
    action: asString(d.action),
    pageId: d.pageId ? asString(d.pageId) : undefined,
    summary: asString(d.summary),
    meta:
      d.meta && typeof d.meta === 'object'
        ? (d.meta as Record<string, unknown>)
        : undefined,
  }
}
