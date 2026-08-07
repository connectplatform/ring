export type {
  ContentCommit,
  ContentFormat,
  VersionedDocument,
} from '@/lib/versioning/types'
export { VERSION_SOFT_CAP } from '@/lib/versioning/types'

export {
  appendCommit,
  createCommit,
  diffAdjacent,
  fromEmbeddedVersions,
  getCommit,
  getTip,
  listCommits,
  toEmbeddedVersions,
  type CreateCommitInput,
  type EmbeddedVersions,
} from '@/lib/versioning/version-store'
