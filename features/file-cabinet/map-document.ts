import type {
  FileCabinetAclEntry,
  FileCabinetDesktop,
  FileCabinetDesktopIcon,
  FileCabinetGalleryItem,
  FileCabinetNode,
  FileCabinetNodeKind,
  FileCabinetAclRole,
  FileCabinetDesktopScope,
  FileCabinetGalleryVisibility,
} from '@/features/file-cabinet/types'
import { normalizeAclRole } from '@/features/file-cabinet/acl'

export {
  normalizeCabinetPath,
  joinCabinetPath,
  cabinetPathDepth,
  assertFolderDepthOk,
} from '@/features/file-cabinet/path'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Coerce PG timestamptz / Date / ISO string — fixes Created/Updated showing "—". */
function iso(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString()
  }
  return ''
}

export function mapNode(doc: Record<string, unknown>): FileCabinetNode {
  const data = (doc.data as Record<string, unknown>) || doc
  return {
    id: str(doc.id || data.id),
    ownerId: str(data.ownerId),
    parentId: data.parentId == null || data.parentId === '' ? null : str(data.parentId),
    kind: (str(data.kind, 'file') as FileCabinetNodeKind) || 'file',
    name: str(data.name),
    path: str(data.path),
    storageUrl: data.storageUrl ? str(data.storageUrl) : undefined,
    storageFileId: data.storageFileId ? str(data.storageFileId) : undefined,
    mime: data.mime ? str(data.mime) : undefined,
    size: data.size != null ? num(data.size) : undefined,
    createdAt: iso(data.createdAt) || iso(doc.created_at),
    updatedAt: iso(data.updatedAt) || iso(doc.updated_at),
  }
}

export function mapAcl(doc: Record<string, unknown>): FileCabinetAclEntry {
  const data = (doc.data as Record<string, unknown>) || doc
  return {
    id: str(doc.id || data.id),
    nodeId: str(data.nodeId),
    userId: str(data.userId),
    role: normalizeAclRole(str(data.role, 'trustee')) as FileCabinetAclRole,
    createdAt: iso(data.createdAt) || iso(doc.created_at),
    updatedAt: iso(data.updatedAt) || iso(doc.updated_at),
  }
}

export function mapDesktop(doc: Record<string, unknown>): FileCabinetDesktop {
  const data = (doc.data as Record<string, unknown>) || doc
  const iconsRaw = Array.isArray(data.icons) ? data.icons : []
  const icons: FileCabinetDesktopIcon[] = iconsRaw.map((raw) => {
    const icon = (raw || {}) as Record<string, unknown>
    const metaRaw = (icon.meta || {}) as Record<string, unknown>
    const filename = str(metaRaw.filename) || str(icon.label)
    return {
      id: str(icon.id),
      kind: (str(icon.kind, 'file') as FileCabinetDesktopIcon['kind']) || 'file',
      label: filename || str(icon.label),
      x: num(icon.x),
      y: num(icon.y),
      nodeId: icon.nodeId ? str(icon.nodeId) : undefined,
      meta: filename ? { filename } : undefined,
    }
  })
  return {
    id: str(doc.id || data.id),
    userId: str(data.userId),
    scope: (str(data.scope, 'own') as FileCabinetDesktopScope) || 'own',
    icons,
    treeExpandedIds: Array.isArray(data.treeExpandedIds)
      ? data.treeExpandedIds.map((id) => str(id)).filter(Boolean)
      : [],
    updatedAt: iso(data.updatedAt) || iso(doc.updated_at),
  }
}

export function mapGalleryItem(doc: Record<string, unknown>): FileCabinetGalleryItem {
  const data = (doc.data as Record<string, unknown>) || doc
  return {
    id: str(doc.id || data.id),
    ownerId: str(data.ownerId),
    nodeId: str(data.nodeId),
    sortOrder: num(data.sortOrder),
    visibility: (str(data.visibility, 'private') as FileCabinetGalleryVisibility) || 'private',
    caption: data.caption ? str(data.caption) : undefined,
    storageUrl: data.storageUrl ? str(data.storageUrl) : undefined,
    mime: data.mime ? str(data.mime) : undefined,
    name: data.name ? str(data.name) : undefined,
    createdAt: iso(data.createdAt) || iso(doc.created_at),
    updatedAt: iso(data.updatedAt) || iso(doc.updated_at),
  }
}
