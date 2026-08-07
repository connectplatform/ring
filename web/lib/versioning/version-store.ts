import type {
  ContentCommit,
  ContentFormat,
  VersionedDocument,
} from '@/lib/versioning/types'
import { VERSION_SOFT_CAP } from '@/lib/versioning/types'

export type CreateCommitInput = {
  parentId: string | null
  createdBy: string
  content: string
  contentFormat: ContentFormat
  label?: string
}

export function createCommit(input: CreateCommitInput): ContentCommit {
  return {
    id: crypto.randomUUID(),
    parentId: input.parentId,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    ...(input.label ? { label: input.label } : {}),
    content: input.content,
    contentFormat: input.contentFormat,
  }
}

/**
 * Keep first commit + newest commits when over soft cap (immutable history, drop middle).
 */
function pruneCommits(commits: ContentCommit[], softCap = VERSION_SOFT_CAP): ContentCommit[] {
  if (commits.length < softCap) return commits
  const first = commits[0]
  const keepRecent = softCap - 1
  const recent = commits.slice(-keepRecent)
  if (recent[0]?.id === first.id) return recent
  return [first, ...recent.filter((c) => c.id !== first.id)].slice(0, softCap)
}

export function appendCommit(
  doc: VersionedDocument | null,
  input: {
    entityType: string
    entityId: string
    createdBy: string
    content: string
    contentFormat: ContentFormat
    label?: string
  },
): { doc: VersionedDocument; commit: ContentCommit } {
  const parentId = doc?.tipCommitId ?? null
  const commit = createCommit({
    parentId,
    createdBy: input.createdBy,
    content: input.content,
    contentFormat: input.contentFormat,
    label: input.label,
  })

  const baseCommits = doc?.commits ?? []
  const nextCommits = pruneCommits([...baseCommits, commit])

  return {
    commit,
    doc: {
      entityType: input.entityType,
      entityId: input.entityId,
      tipCommitId: commit.id,
      commits: nextCommits,
    },
  }
}

export function getCommit(
  doc: VersionedDocument | null | undefined,
  commitId: string,
): ContentCommit | null {
  if (!doc?.commits?.length) return null
  return doc.commits.find((c) => c.id === commitId) ?? null
}

export function getTip(doc: VersionedDocument | null | undefined): ContentCommit | null {
  if (!doc?.tipCommitId) return null
  return getCommit(doc, doc.tipCommitId)
}

export function listCommits(doc: VersionedDocument | null | undefined): ContentCommit[] {
  return doc?.commits ? [...doc.commits] : []
}

export function diffAdjacent(
  doc: VersionedDocument | null | undefined,
  index: number,
): { from: string; to: string } | null {
  const commits = listCommits(doc)
  if (index < 0 || index >= commits.length) return null
  const to = commits[index]
  if (!to) return null
  if (index === 0) return { from: '', to: to.content }
  const from = commits[index - 1]
  return { from: from?.content ?? '', to: to.content }
}

/** News document embeds VersionedDocument fields without entityType/entityId duplication. */
export type EmbeddedVersions = {
  tipCommitId: string
  commits: ContentCommit[]
}

export function toEmbeddedVersions(doc: VersionedDocument): EmbeddedVersions {
  return { tipCommitId: doc.tipCommitId, commits: doc.commits }
}

export function fromEmbeddedVersions(
  entityType: string,
  entityId: string,
  embedded?: EmbeddedVersions | null,
): VersionedDocument | null {
  if (!embedded?.tipCommitId || !Array.isArray(embedded.commits)) return null
  return {
    entityType,
    entityId,
    tipCommitId: embedded.tipCommitId,
    commits: embedded.commits,
  }
}
