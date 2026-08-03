export type FileCabinetNodeKind = 'file' | 'dir'
/** owner = full CRUD + share; trustee = view/download only (trusted viewer). */
export type FileCabinetAclRole = 'owner' | 'trustee'
export type FileCabinetDesktopScope = 'own' | 'shared'
export type FileCabinetGalleryVisibility = 'private' | 'unlisted' | 'public'

export interface FileCabinetNode {
  id: string
  ownerId: string
  parentId: string | null
  kind: FileCabinetNodeKind
  name: string
  path: string
  storageUrl?: string
  storageFileId?: string
  mime?: string
  size?: number
  createdAt: string
  updatedAt: string
}

export interface FileCabinetAclEntry {
  id: string
  nodeId: string
  userId: string
  role: FileCabinetAclRole
  createdAt: string
  updatedAt: string
}

/** Desktop icon meta — visible filename SSOT (never RingFileBase object UUID). Rename overwrites; no history. */
export interface FileCabinetDesktopIconMeta {
  /** User-facing filename shown on desktop / tree / download disposition */
  filename?: string
}

export interface FileCabinetDesktopIcon {
  id: string
  kind: FileCabinetNodeKind | 'shortcut'
  /** Display label; prefer meta.filename when set */
  label: string
  x: number
  y: number
  nodeId?: string
  meta?: FileCabinetDesktopIconMeta
}

export interface FileCabinetDesktop {
  id: string
  userId: string
  scope: FileCabinetDesktopScope
  icons: FileCabinetDesktopIcon[]
  /** Folder ids expanded in the right-rail tree (persisted with desktop layout). */
  treeExpandedIds?: string[]
  updatedAt: string
}

export interface FileCabinetGalleryItem {
  id: string
  ownerId: string
  nodeId: string
  sortOrder: number
  visibility: FileCabinetGalleryVisibility
  caption?: string
  /** CDN URL for public delivery: RINGBASE_PUBLIC_URL/files/{fileId} */
  storageUrl?: string
  mime?: string
  name?: string
  createdAt: string
  updatedAt: string
}

export type FileCabinetPermission =
  | { ok: true; role: FileCabinetAclRole }
  | { ok: false; error: string }
