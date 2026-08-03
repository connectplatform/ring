/**
 * Shared content versioning — immutable commits + tip pointer.
 * Used by news ArticleEditor (and later task message audit). Not a conductor.
 */

export type ContentFormat = 'html' | 'text' | 'json'

export type ContentCommit = {
  id: string
  parentId: string | null
  createdAt: string
  createdBy: string
  label?: string
  content: string
  contentFormat: ContentFormat
}

export type VersionedDocument = {
  entityType: string
  entityId: string
  tipCommitId: string
  commits: ContentCommit[]
}

/** Soft cap — keep first commit + most recent when pruning. */
export const VERSION_SOFT_CAP = 50
