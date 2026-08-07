/** Ring Admin Wiki — domain types (Markdown + [[wikilinks]] vault). */

export type VaultKey = 'tenant' | `po:${string}`

export type WikiPageKind =
  | 'page'
  | 'schema'
  | 'entity'
  | 'concept'
  | 'source'
  | 'synthesis'

export type WikiPageStatus = 'draft' | 'published' | 'archived'

export type WikiWriteMode = 'replace' | 'append'

export type WikiLinkKind = 'local' | 'tenant_ref'

export interface WikiFrontmatter {
  tags?: string[]
  aliases?: string[]
  status?: WikiPageStatus
  sources?: string[]
  /** Bump when schema graph repair / link parser semantics change */
  schemaLinksVersion?: number
}

export interface WikiPage {
  id: string
  title: string
  slug: string
  path: string
  bodyMarkdown: string
  vaultKey: VaultKey
  kind: WikiPageKind
  frontmatter: WikiFrontmatter
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface WikiLink {
  id: string
  fromId: string
  toVaultKey: VaultKey
  toSlug: string
  toId: string | null
  linkKind: WikiLinkKind
  rawText: string
  createdAt: string
}

export interface WikiEvent {
  id: string
  vaultKey: VaultKey
  at: string
  actorId: string
  actorRole: string
  action: string
  pageId?: string
  summary: string
  meta?: Record<string, unknown>
}

export interface ParsedWikiLink {
  raw: string
  display: string
  target: string
  linkKind: WikiLinkKind
}

/** legiox-knowledge-shaped search hit */
export interface WikiSearchMatch {
  concept: string
  path: string
  confidence: number
  score: number
  matched_terms: string[]
  snippet: string
  quick_answers: string[]
  related_concepts: string[]
  pageId: string
  vaultKey: VaultKey
  slug: string
}

export interface WikiLintIssue {
  code: string
  message: string
  pageId?: string
  slug?: string
}

export interface CreateWikiPageInput {
  title: string
  slug?: string
  path?: string
  bodyMarkdown?: string
  vaultKey: VaultKey
  kind?: WikiPageKind
  frontmatter?: WikiFrontmatter
}

export interface UpdateWikiPageInput {
  title?: string
  slug?: string
  path?: string
  bodyMarkdown?: string
  kind?: WikiPageKind
  frontmatter?: WikiFrontmatter
  mode?: WikiWriteMode
  appendHeading?: string
}
