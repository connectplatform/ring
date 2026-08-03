import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import type { WikiActor } from '@/features/wiki/acl'
import {
  canCreateInVault,
  canDeleteInVault,
  canReadVault,
  canWriteVault,
  describeActorRole,
} from '@/features/wiki/acl'
import { mapWikiEvent, mapWikiLink, mapWikiPage } from '@/features/wiki/map-wiki-document'
import { scoreWikiPages } from '@/features/wiki/search-score'
import {
  LEGACY_SCHEMA_LINK_EXAMPLES_MARKER,
  SCHEMA_LINKS_VERSION,
  TENANT_SCHEMA_BODY,
  TENANT_SCHEMA_SLUG,
  TENANT_SCHEMA_TITLE,
} from '@/features/wiki/schema-seed'
import type {
  CreateWikiPageInput,
  UpdateWikiPageInput,
  VaultKey,
  WikiEvent,
  WikiLink,
  WikiLintIssue,
  WikiPage,
  WikiSearchMatch,
} from '@/features/wiki/types'
import { TENANT_VAULT, normalizePath, slugifyTitle } from '@/features/wiki/vault-key'
import { parseWikiLinks } from '@/features/wiki/wikilink-parser'
import {
  findPageByWikiTarget,
  wikiTargetSlugHint,
} from '@/features/wiki/resolve-page-target'

const PAGES = 'wiki_pages'
const LINKS = 'wiki_links'
const EVENTS = 'wiki_events'

async function ensureDb() {
  await initializeDatabase()
}

function gateError(gate: { ok: boolean; error?: string }): string {
  return gate.ok ? 'Access denied' : (gate.error || 'Access denied')
}

function nowIso() {
  return new Date().toISOString()
}

function err(message: string): Error {
  return new Error(message)
}

export async function ensureTenantSchema(actor: WikiActor): Promise<WikiPage> {
  const existing = await findBySlug(TENANT_VAULT, TENANT_SCHEMA_SLUG)
  if (existing) {
    const legacyBody = existing.bodyMarkdown.includes(
      LEGACY_SCHEMA_LINK_EXAMPLES_MARKER,
    )
    const linksVersion = existing.frontmatter.schemaLinksVersion ?? 0
    const needsResync = legacyBody || linksVersion < SCHEMA_LINKS_VERSION

    if (!needsResync) return existing

    await ensureDb()
    const ts = nowIso()
    const nextFrontmatter = {
      ...existing.frontmatter,
      status: existing.frontmatter.status ?? ('published' as const),
      tags: Array.from(
        new Set([...(existing.frontmatter.tags || []), 'schema']),
      ),
      schemaLinksVersion: SCHEMA_LINKS_VERSION,
    }
    const patch: Record<string, unknown> = {
      frontmatter: nextFrontmatter,
      updatedAt: ts,
      updatedBy: actor.userId || 'system',
    }
    if (legacyBody) {
      patch.bodyMarkdown = TENANT_SCHEMA_BODY
    }
    await db().updateDoc(PAGES, existing.id, patch, { merge: true })
    const refreshed =
      (await findBySlug(TENANT_VAULT, TENANT_SCHEMA_SLUG)) || existing
    await rebuildLinks(refreshed)
    await appendEvent({
      actor,
      vaultKey: TENANT_VAULT,
      action: legacyBody ? 'repair_schema' : 'resync_schema_links',
      pageId: refreshed.id,
      summary: legacyBody
        ? 'Repaired _schema example wikilinks (code-fence docs)'
        : `Resynced _schema wiki_links to schemaLinksVersion=${SCHEMA_LINKS_VERSION}`,
    })
    return refreshed
  }

  // Seed bypasses agent write deny — system bootstrap only when missing
  await ensureDb()
  const ts = nowIso()
  const data = {
    title: TENANT_SCHEMA_TITLE,
    slug: TENANT_SCHEMA_SLUG,
    path: '',
    bodyMarkdown: TENANT_SCHEMA_BODY,
    vaultKey: TENANT_VAULT,
    kind: 'schema' as const,
    frontmatter: {
      status: 'published' as const,
      tags: ['schema'],
      schemaLinksVersion: SCHEMA_LINKS_VERSION,
    },
    createdBy: actor.userId || 'system',
    updatedBy: actor.userId || 'system',
    createdAt: ts,
    updatedAt: ts,
  }
  const created = await db().createDoc(PAGES, data)
  if (!created.success || !created.data) {
    throw created.error || err('Failed to seed _schema')
  }
  const page = mapWikiPage(created.data)
  await rebuildLinks(page)
  await appendEvent({
    actor,
    vaultKey: TENANT_VAULT,
    action: 'seed_schema',
    pageId: page.id,
    summary: 'Seeded tenant _schema',
  })
  return page
}

export async function listPages(
  actor: WikiActor,
  vaultKey: VaultKey,
  opts?: { pathPrefix?: string; kind?: string; limit?: number },
): Promise<WikiPage[]> {
  const gate = canReadVault(actor, vaultKey)
  if (!gate.ok) throw err(gateError(gate))

  await ensureDb()
  const result = await db().queryDocs({
    collection: PAGES,
    filters: [{ field: 'vaultKey', operator: '==', value: vaultKey }],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: opts?.limit ?? 500 },
  })
  if (!result.success) throw (result.error as Error) || err('listPages failed')

  let pages = (result.data || []).map(mapWikiPage)
  if (opts?.pathPrefix) {
    const prefix = normalizePath(opts.pathPrefix)
    pages = pages.filter(
      (p) => p.path === prefix || p.path.startsWith(prefix + '/'),
    )
  }
  if (opts?.kind) {
    pages = pages.filter((p) => p.kind === opts.kind)
  }
  return pages
}

export async function getPage(
  actor: WikiActor,
  id: string,
): Promise<WikiPage | null> {
  await ensureDb()
  const result = await db().readDoc(PAGES, id)
  if (!result.success) throw (result.error as Error) || err('getPage failed')
  if (!result.data) return null
  const page = mapWikiPage(result.data)
  const gate = canReadVault(actor, page.vaultKey)
  if (!gate.ok) throw err(gateError(gate))
  return page
}

export async function getPageBySlug(
  actor: WikiActor,
  vaultKey: VaultKey,
  slug: string,
): Promise<WikiPage | null> {
  const gate = canReadVault(actor, vaultKey)
  if (!gate.ok) throw err(gateError(gate))
  return findBySlug(vaultKey, slug)
}

async function findBySlug(vaultKey: VaultKey, slug: string): Promise<WikiPage | null> {
  await ensureDb()
  const result = await db().findOneDoc(PAGES, [
    { field: 'vaultKey', operator: '==', value: vaultKey },
    { field: 'slug', operator: '==', value: slug },
  ])
  if (!result.success) throw (result.error as Error) || err('findBySlug failed')
  if (!result.data) return null
  return mapWikiPage(result.data)
}

export async function createPage(
  actor: WikiActor,
  input: CreateWikiPageInput,
): Promise<WikiPage> {
  const gate = canCreateInVault(actor, input.vaultKey)
  if (!gate.ok) throw err(gateError(gate))

  const slug = (input.slug?.trim() || slugifyTitle(input.title)).toLowerCase()
  const existing = await findBySlug(input.vaultKey, slug)
  if (existing) throw err(`Slug already exists in vault: ${slug}`)

  const ts = nowIso()
  await ensureDb()
  const data = {
    title: input.title.trim(),
    slug,
    path: normalizePath(input.path),
    bodyMarkdown: input.bodyMarkdown ?? '',
    vaultKey: input.vaultKey,
    kind: input.kind ?? 'page',
    frontmatter: {
      status: 'published' as const,
      ...input.frontmatter,
    },
    createdBy: actor.userId,
    updatedBy: actor.userId,
    createdAt: ts,
    updatedAt: ts,
  }

  const created = await db().createDoc(PAGES, data)
  if (!created.success || !created.data) {
    throw created.error || err('createPage failed')
  }
  const page = mapWikiPage(created.data)
  await rebuildLinks(page)
  await appendEvent({
    actor,
    vaultKey: page.vaultKey,
    action: 'create',
    pageId: page.id,
    summary: `Created ${page.title}`,
  })
  return page
}

export async function updatePage(
  actor: WikiActor,
  id: string,
  input: UpdateWikiPageInput,
): Promise<WikiPage> {
  const current = await getPage(actor, id)
  if (!current) throw err('Page not found')

  const mode = input.mode ?? 'replace'
  const gate = canWriteVault(actor, current.vaultKey, mode)
  if (!gate.ok) throw err(gateError(gate))

  // Integrator tenant: force append semantics
  if (
    gate.writeMode === 'append' &&
    mode === 'replace' &&
    input.bodyMarkdown !== undefined
  ) {
    throw err('Append-only: use mode append')
  }

  let bodyMarkdown = current.bodyMarkdown
  if (input.bodyMarkdown !== undefined) {
    if (mode === 'append' || gate.writeMode === 'append') {
      const heading =
        input.appendHeading?.trim() ||
        `## Append ${new Date().toISOString().slice(0, 16)}`
      const chunk = input.bodyMarkdown.trim()
      bodyMarkdown = `${current.bodyMarkdown.trimEnd()}\n\n${heading}\n\n${chunk}\n`
    } else {
      bodyMarkdown = input.bodyMarkdown
    }
  }

  // Integrator on tenant cannot rename identity fields
  const isIntegratorAppendOnly =
    gate.writeMode === 'append' &&
    current.vaultKey === TENANT_VAULT &&
    !actor.isBuyer &&
    !actor.isAgent

  if (isIntegratorAppendOnly) {
    if (input.slug && input.slug !== current.slug) {
      throw err('Integrators cannot rename tenant pages')
    }
    if (input.path !== undefined && normalizePath(input.path) !== current.path) {
      throw err('Integrators cannot move tenant pages')
    }
    if (input.title && input.title !== current.title) {
      throw err('Integrators cannot rename tenant page titles')
    }
  }

  if (input.slug && input.slug !== current.slug) {
    const clash = await findBySlug(current.vaultKey, input.slug.toLowerCase())
    if (clash && clash.id !== id) throw err('Slug already exists')
  }

  const ts = nowIso()
  await ensureDb()
  const patch: Record<string, unknown> = {
    updatedBy: actor.userId,
    updatedAt: ts,
    bodyMarkdown,
  }
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.slug !== undefined) patch.slug = input.slug.trim().toLowerCase()
  if (input.path !== undefined) patch.path = normalizePath(input.path)
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.frontmatter !== undefined) {
    patch.frontmatter = { ...current.frontmatter, ...input.frontmatter }
  }

  const updated = await db().updateDoc(PAGES, id, patch, { merge: true })
  if (!updated.success || !updated.data) {
    throw updated.error || err('updatePage failed')
  }
  const page = mapWikiPage(updated.data)
  await rebuildLinks(page)
  await appendEvent({
    actor,
    vaultKey: page.vaultKey,
    action: mode === 'append' ? 'append' : 'update',
    pageId: page.id,
    summary: `${mode === 'append' ? 'Appended' : 'Updated'} ${page.title}`,
  })
  return page
}

export async function deletePage(actor: WikiActor, id: string): Promise<void> {
  const current = await getPage(actor, id)
  if (!current) throw err('Page not found')
  if (current.slug === TENANT_SCHEMA_SLUG && current.vaultKey === TENANT_VAULT) {
    throw err('Cannot delete tenant _schema')
  }
  const gate = canDeleteInVault(actor, current.vaultKey)
  if (!gate.ok) throw err(gateError(gate))

  await ensureDb()
  await deleteLinksFrom(current.id)
  const del = await db().deleteDoc(PAGES, id)
  if (!del.success) throw del.error || err('deletePage failed')
  await appendEvent({
    actor,
    vaultKey: current.vaultKey,
    action: 'delete',
    pageId: id,
    summary: `Deleted ${current.title}`,
  })
}

export async function searchPages(
  actor: WikiActor,
  query: string,
  opts?: { vaultKey?: VaultKey; context?: string; limit?: number },
): Promise<{ matches: WikiSearchMatch[]; source_pool_size: number }> {
  const vaults: VaultKey[] = []
  if (opts?.vaultKey) {
    const gate = canReadVault(actor, opts.vaultKey)
    if (!gate.ok) throw err(gateError(gate))
    vaults.push(opts.vaultKey)
  } else {
    // Search tenant if readable; caller scopes project separately
    if (canReadVault(actor, TENANT_VAULT).ok) vaults.push(TENANT_VAULT)
  }

  const pages: WikiPage[] = []
  for (const vk of vaults) {
    pages.push(...(await listPages(actor, vk, { limit: 500 })))
  }

  const matches = scoreWikiPages(pages, query, opts?.context).slice(
    0,
    opts?.limit ?? 10,
  )
  return { matches, source_pool_size: pages.length }
}

export async function getBacklinks(
  actor: WikiActor,
  pageId: string,
): Promise<WikiLink[]> {
  const page = await getPage(actor, pageId)
  if (!page) throw err('Page not found')

  await ensureDb()
  const result = await db().queryDocs({
    collection: LINKS,
    filters: [{ field: 'toId', operator: '==', value: pageId }],
    pagination: { limit: 200 },
  })
  if (!result.success) throw (result.error as Error) || err('getBacklinks failed')
  return (result.data || []).map(mapWikiLink)
}

export async function lintVault(
  actor: WikiActor,
  vaultKey: VaultKey,
): Promise<WikiLintIssue[]> {
  const pages = await listPages(actor, vaultKey)
  const issues: WikiLintIssue[] = []

  await ensureDb()
  const linkResult = await db().queryDocs({
    collection: LINKS,
    filters: [],
    pagination: { limit: 2000 },
  })
  const allLinks = (linkResult.success ? linkResult.data || [] : []).map(mapWikiLink)
  const pageIds = new Set(pages.map((p) => p.id))
  const vaultLinks = allLinks.filter((l) => pageIds.has(l.fromId))

  const inbound = new Set(vaultLinks.filter((l) => l.toId).map((l) => l.toId as string))

  for (const page of pages) {
    if (page.slug === TENANT_SCHEMA_SLUG) continue
    if (!inbound.has(page.id) && page.kind !== 'schema') {
      issues.push({
        code: 'orphan',
        message: `Orphan page: ${page.title}`,
        pageId: page.id,
        slug: page.slug,
      })
    }
  }

  const deadSeen = new Set<string>()
  for (const link of vaultLinks) {
    if (!link.toId) {
      const dedupeKey = `${link.fromId}:${link.linkKind}:${link.toSlug}`
      if (deadSeen.has(dedupeKey)) continue
      deadSeen.add(dedupeKey)
      issues.push({
        code: 'dead_link',
        message: `Unresolved ${link.linkKind} link to "${link.toSlug}" from ${link.fromId}`,
        pageId: link.fromId,
        slug: link.toSlug,
      })
    }
  }

  // Mentions without pages (concept stubs) — skip schema constitution page
  const missingSeen = new Set<string>()
  for (const page of pages) {
    if (page.slug === TENANT_SCHEMA_SLUG) continue
    const parsed = parseWikiLinks(page.bodyMarkdown)
    for (const pl of parsed) {
      const targetVault = pl.linkKind === 'tenant_ref' ? TENANT_VAULT : vaultKey
      if (targetVault !== vaultKey) continue
      if (findPageByWikiTarget(pages, pl.target)) continue

      const dedupeKey = `${wikiTargetSlugHint(pl.target)}:${pl.target.toLowerCase()}`
      if (missingSeen.has(dedupeKey)) continue
      missingSeen.add(dedupeKey)

      issues.push({
        code: 'missing_page',
        message: `Wikilink [[${pl.target}]] has no page`,
        pageId: page.id,
        slug: pl.target,
      })
    }
  }

  return issues
}

/**
 * Auto-create stub concept pages for unresolved local wikilinks in a vault.
 * Skips tenant_ref targets (those belong in the tenant vault) and schema page.
 */
export async function ensureMissingStubPages(
  actor: WikiActor,
  vaultKey: VaultKey,
): Promise<{ created: WikiPage[]; skipped: string[] }> {
  const issues = await lintVault(actor, vaultKey)
  const missing = issues.filter((i) => i.code === 'missing_page' && i.slug)
  const created: WikiPage[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  const sourcePageIds = new Set<string>()

  for (const issue of missing) {
    const target = (issue.slug || '').trim()
    if (!target) continue
    if (issue.pageId) sourcePageIds.add(issue.pageId)

    // path/slug form → folder path + leaf slug (not slugify of full path)
    let path = ''
    let title = target
    let slug: string
    if (target.includes('/')) {
      const parts = target.split('/').filter(Boolean)
      path = parts.slice(0, -1).join('/')
      title = parts[parts.length - 1] || target
      slug = slugifyTitle(title)
    } else {
      slug = slugifyTitle(target)
      title = target.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    if (seen.has(`${path}/${slug}`)) continue
    seen.add(`${path}/${slug}`)

    // Slug is unique per vault — skip if any page already owns it
    const existing = await findBySlug(vaultKey, slug)
    if (existing) {
      skipped.push(slug)
      continue
    }

    try {
      const page = await createPage(actor, {
        title,
        slug,
        path,
        vaultKey,
        kind: 'concept',
        bodyMarkdown: `# ${title}\n\nStub created from wiki lint (missing \`[[${target}]]\`).\n`,
        frontmatter: { status: 'draft', tags: ['stub', 'auto'] },
      })
      created.push(page)
    } catch {
      skipped.push(slug)
    }
  }

  // Rebuild edges on source pages so dead_link / toId catch up to new stubs
  if (created.length > 0 && sourcePageIds.size > 0) {
    const vaultPages = await listPagesUnsafe(vaultKey)
    for (const id of sourcePageIds) {
      const page = vaultPages.find((p) => p.id === id)
      if (page) await rebuildLinks(page)
    }
  }

  return { created, skipped }
}

async function resolveTarget(
  fromVault: VaultKey,
  target: string,
  linkKind: 'local' | 'tenant_ref',
): Promise<{ vaultKey: VaultKey; page: WikiPage | null; slug: string }> {
  const vaultKey = linkKind === 'tenant_ref' ? TENANT_VAULT : fromVault
  const candidates = await listPagesUnsafe(vaultKey)
  const page = findPageByWikiTarget(candidates, target)
  return {
    vaultKey,
    page,
    slug: page?.slug || wikiTargetSlugHint(target),
  }
}

/** Internal list without ACL — used only after vault already authorized */
async function listPagesUnsafe(vaultKey: VaultKey): Promise<WikiPage[]> {
  await ensureDb()
  const result = await db().queryDocs({
    collection: PAGES,
    filters: [{ field: 'vaultKey', operator: '==', value: vaultKey }],
    pagination: { limit: 500 },
  })
  if (!result.success) return []
  return (result.data || []).map(mapWikiPage)
}

async function deleteLinksFrom(fromId: string): Promise<void> {
  await ensureDb()
  const result = await db().queryDocs({
    collection: LINKS,
    filters: [{ field: 'fromId', operator: '==', value: fromId }],
    pagination: { limit: 500 },
  })
  if (!result.success || !result.data) return
  for (const row of result.data) {
    await db().deleteDoc(LINKS, row.id)
  }
}

async function rebuildLinks(page: WikiPage): Promise<void> {
  await deleteLinksFrom(page.id)
  const parsed = parseWikiLinks(page.bodyMarkdown)
  await ensureDb()
  const ts = nowIso()
  for (const pl of parsed) {
    const resolved = await resolveTarget(page.vaultKey, pl.target, pl.linkKind)
    await db().createDoc(LINKS, {
      fromId: page.id,
      toVaultKey: resolved.vaultKey,
      toSlug: resolved.slug,
      toId: resolved.page?.id ?? null,
      linkKind: pl.linkKind,
      rawText: pl.raw,
      createdAt: ts,
    })
  }
}

export async function appendEvent(input: {
  actor: WikiActor
  vaultKey: VaultKey
  action: string
  summary: string
  pageId?: string
  meta?: Record<string, unknown>
}): Promise<WikiEvent> {
  await ensureDb()
  const ts = nowIso()
  const created = await db().createDoc(EVENTS, {
    vaultKey: input.vaultKey,
    at: ts,
    actorId: input.actor.userId,
    actorRole: describeActorRole(input.actor),
    action: input.action,
    pageId: input.pageId,
    summary: input.summary,
    meta: input.meta,
  })
  if (!created.success || !created.data) {
    throw created.error || err('appendEvent failed')
  }
  return mapWikiEvent(created.data)
}

export async function listEvents(
  actor: WikiActor,
  vaultKey: VaultKey,
  limit = 50,
): Promise<WikiEvent[]> {
  const gate = canReadVault(actor, vaultKey)
  if (!gate.ok) throw err(gateError(gate))
  await ensureDb()
  const result = await db().queryDocs({
    collection: EVENTS,
    filters: [{ field: 'vaultKey', operator: '==', value: vaultKey }],
    orderBy: [{ field: 'at', direction: 'desc' }],
    pagination: { limit },
  })
  if (!result.success) throw (result.error as Error) || err('listEvents failed')
  return (result.data || []).map(mapWikiEvent)
}

export async function ensureProjectVault(
  actor: WikiActor,
  orderId: string,
): Promise<{ vaultKey: VaultKey; seeded: boolean }> {
  const vaultKey = `po:${orderId}` as VaultKey
  const gate = canReadVault(actor, vaultKey)
  if (!gate.ok) throw err(gateError(gate))

  // Lazy: no mandatory seed page; first write creates content
  await appendEvent({
    actor,
    vaultKey,
    action: 'open_vault',
    summary: `Opened project vault ${vaultKey}`,
  }).catch(() => undefined)

  return { vaultKey, seeded: true }
}
