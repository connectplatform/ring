import 'server-only'

import { randomUUID } from 'crypto'
import { db, initializeDatabase } from '@/lib/database'
import { publishToUserTunnel } from '@/lib/tunnel/publisher'
import { canEditAcl, canOwnerMutate, canRead } from '@/features/file-cabinet/acl'
import {
  assertFolderDepthOk,
  cabinetPathDepth,
  joinCabinetPath,
  mapAcl,
  mapDesktop,
  mapGalleryItem,
  mapNode,
  normalizeCabinetPath,
} from '@/features/file-cabinet/map-document'
import type {
  FileCabinetAclEntry,
  FileCabinetAclRole,
  FileCabinetDesktop,
  FileCabinetDesktopIcon,
  FileCabinetDesktopScope,
  FileCabinetGalleryItem,
  FileCabinetGalleryVisibility,
  FileCabinetNode,
  FileCabinetNodeKind,
} from '@/features/file-cabinet/types'
import { FILE_CABINET_DESKTOP_CHANNEL } from '@/features/file-cabinet/constants'

const NODES = 'file_cabinet_nodes'
const ACL = 'file_cabinet_acl'
const DESKTOP = 'file_cabinet_desktop'
const GALLERY = 'file_cabinet_gallery_items'

async function ensureDb() {
  await initializeDatabase()
}

function nowIso() {
  return new Date().toISOString()
}

function err(message: string): Error {
  return new Error(message)
}

function unwrapDoc(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const doc = raw as Record<string, unknown>
  if (doc.data && typeof doc.data === 'object') {
    return { ...doc, ...(doc.data as Record<string, unknown>), id: doc.id }
  }
  return doc
}

async function findAcl(
  nodeId: string,
  userId: string,
): Promise<FileCabinetAclEntry | null> {
  await ensureDb()
  const result = await db().findOneDoc(ACL, [
    { field: 'nodeId', operator: '==', value: nodeId },
    { field: 'userId', operator: '==', value: userId },
  ])
  if (!result.success) throw (result.error as Error) || err('findAcl failed')
  if (!result.data) return null
  return mapAcl(unwrapDoc(result.data))
}

async function resolveRoleForNode(
  node: FileCabinetNode,
  userId: string,
): Promise<FileCabinetAclRole | null> {
  if (node.ownerId === userId) return 'owner'
  let current: FileCabinetNode | null = node
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    const acl = await findAcl(current.id, userId)
    if (acl) return acl.role
    if (!current.parentId) break
    current = await getNodeUnsafe(current.parentId)
  }
  return null
}

async function getNodeUnsafe(id: string): Promise<FileCabinetNode | null> {
  await ensureDb()
  const result = await db().readDoc(NODES, id)
  if (!result.success) throw (result.error as Error) || err('getNode failed')
  if (!result.data) return null
  return mapNode(unwrapDoc(result.data))
}

export async function getNode(
  userId: string,
  id: string,
): Promise<FileCabinetNode | null> {
  const node = await getNodeUnsafe(id)
  if (!node) return null
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canRead(role)) {
    throw err(role ? 'Access denied' : 'Access denied')
  }
  return node
}

export async function listChildren(
  userId: string,
  parentId: string | null,
  opts?: { ownerOnly?: boolean },
): Promise<FileCabinetNode[]> {
  await ensureDb()
  // JSONB `null` parentId does not filter reliably via == null — load by owner/parent then filter.
  const result = await db().queryDocs({
    collection: NODES,
    filters: parentId
      ? [{ field: 'parentId', operator: '==', value: parentId }]
      : [{ field: 'ownerId', operator: '==', value: userId }],
    orderBy: [{ field: 'name', direction: 'asc' }],
    pagination: { limit: 500 },
  })
  if (!result.success) throw (result.error as Error) || err('listChildren failed')

  let nodes = (result.data || []).map((d) => mapNode(unwrapDoc(d as Record<string, unknown>)))

  if (parentId == null) {
    nodes = nodes.filter((n) => n.parentId == null || n.parentId === '')
  }

  if (opts?.ownerOnly) {
    nodes = nodes.filter((n) => n.ownerId === userId)
  }

  const allowed: FileCabinetNode[] = []
  for (const node of nodes) {
    const role = await resolveRoleForNode(node, userId)
    if (role && canRead(role)) allowed.push(node)
  }
  return allowed
}

export async function listSharedWithMe(userId: string): Promise<FileCabinetNode[]> {
  await ensureDb()
  const aclResult = await db().queryDocs({
    collection: ACL,
    filters: [{ field: 'userId', operator: '==', value: userId }],
    pagination: { limit: 500 },
  })
  if (!aclResult.success) throw (aclResult.error as Error) || err('listShared ACL failed')

  const nodeIds = (aclResult.data || [])
    .map((d) => mapAcl(unwrapDoc(d as Record<string, unknown>)))
    .filter((e) => e.role === 'trustee')
    .map((e) => e.nodeId)
    .filter(Boolean)

  const nodes: FileCabinetNode[] = []
  for (const id of nodeIds) {
    const node = await getNodeUnsafe(id)
    if (node) nodes.push(node)
  }
  return nodes
}

/** All folders the user can navigate in the right-rail tree (own or shared). */
export async function listFolderTree(
  userId: string,
  scope: FileCabinetDesktopScope,
): Promise<FileCabinetNode[]> {
  await ensureDb()

  if (scope === 'own') {
    const result = await db().queryDocs({
      collection: NODES,
      filters: [{ field: 'ownerId', operator: '==', value: userId }],
      orderBy: [{ field: 'name', direction: 'asc' }],
      pagination: { limit: 500 },
    })
    if (!result.success) throw (result.error as Error) || err('listFolderTree failed')
    return (result.data || [])
      .map((d) => mapNode(unwrapDoc(d as Record<string, unknown>)))
      .filter((n) => n.kind === 'dir' && n.ownerId === userId)
  }

  const shared = await listSharedWithMe(userId)
  const byId = new Map<string, FileCabinetNode>()
  for (const n of shared) {
    if (n.kind === 'dir') byId.set(n.id, n)
  }

  const queue = shared.filter((n) => n.kind === 'dir').map((n) => n.id)
  const seen = new Set(queue)
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const children = await listChildren(userId, parentId)
    for (const child of children) {
      if (child.kind !== 'dir') continue
      byId.set(child.id, child)
      if (!seen.has(child.id)) {
        seen.add(child.id)
        queue.push(child.id)
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))
}

export async function createDir(
  userId: string,
  input: { name: string; parentId?: string | null },
): Promise<FileCabinetNode> {
  const name = input.name.trim()
  if (!name) throw err('Folder name required')

  let parentPath = ''
  let parentId: string | null = input.parentId ?? null
  if (parentId) {
    const parent = await getNode(userId, parentId)
    if (!parent || parent.kind !== 'dir') throw err('Parent folder not found')
    const role = await resolveRoleForNode(parent, userId)
    if (!role || !canOwnerMutate(role)) throw err('Only owner can create folders here')
    parentPath = parent.path
  }

  const ts = nowIso()
  const id = randomUUID()
  const path = joinCabinetPath(parentPath, name)
  assertFolderDepthOk(path)
  const data = {
    ownerId: userId,
    parentId,
    kind: 'dir' as FileCabinetNodeKind,
    name,
    path: normalizeCabinetPath(path),
    createdAt: ts,
    updatedAt: ts,
  }

  await ensureDb()
  const created = await db().createDoc(NODES, data, { id })
  if (!created.success) throw (created.error as Error) || err('createDir failed')

  const aclId = randomUUID()
  await db().createDoc(
    ACL,
    {
      nodeId: id,
      userId,
      role: 'owner' as FileCabinetAclRole,
      createdAt: ts,
      updatedAt: ts,
    },
    { id: aclId },
  )

  return mapNode({ id, ...data })
}

export async function createFileNode(
  userId: string,
  input: {
    name: string
    parentId?: string | null
    storageUrl: string
    storageFileId?: string
    mime?: string
    size?: number
  },
): Promise<FileCabinetNode> {
  const name = input.name.trim()
  if (!name) throw err('File name required')
  if (!input.storageUrl) throw err('storageUrl required')

  let parentPath = ''
  let parentId: string | null = input.parentId ?? null
  if (parentId) {
    const parent = await getNode(userId, parentId)
    if (!parent || parent.kind !== 'dir') throw err('Parent folder not found')
    const role = await resolveRoleForNode(parent, userId)
    if (!role || !canOwnerMutate(role)) throw err('Only owner can upload here')
    parentPath = parent.path
  }

  const ts = nowIso()
  const id = randomUUID()
  const path = joinCabinetPath(parentPath, name)
  const data = {
    ownerId: userId,
    parentId,
    kind: 'file' as FileCabinetNodeKind,
    name,
    path: normalizeCabinetPath(path),
    storageUrl: input.storageUrl,
    storageFileId: input.storageFileId,
    mime: input.mime,
    size: input.size,
    createdAt: ts,
    updatedAt: ts,
  }

  await ensureDb()
  const created = await db().createDoc(NODES, data, { id })
  if (!created.success) throw (created.error as Error) || err('createFile failed')

  const aclId = randomUUID()
  await db().createDoc(
    ACL,
    {
      nodeId: id,
      userId,
      role: 'owner' as FileCabinetAclRole,
      createdAt: ts,
      updatedAt: ts,
    },
    { id: aclId },
  )

  return mapNode({ id, ...data })
}

export async function deleteNode(userId: string, id: string): Promise<void> {
  const node = await getNodeUnsafe(id)
  if (!node) return
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canOwnerMutate(role)) throw err('Only owner can delete')

  await ensureDb()
  if (node.kind === 'dir') {
    const children = await listChildren(userId, id)
    for (const child of children) {
      await deleteNode(userId, child.id)
    }
  }

  const aclResult = await db().queryDocs({
    collection: ACL,
    filters: [{ field: 'nodeId', operator: '==', value: id }],
    pagination: { limit: 100 },
  })
  if (aclResult.success && aclResult.data) {
    for (const row of aclResult.data) {
      const entry = mapAcl(unwrapDoc(row as Record<string, unknown>))
      await db().deleteDoc(ACL, entry.id)
    }
  }

  await db().deleteDoc(NODES, id)
}

export async function setTrustees(
  userId: string,
  nodeId: string,
  trusteeUserIds: string[],
): Promise<FileCabinetAclEntry[]> {
  const node = await getNodeUnsafe(nodeId)
  if (!node) throw err('Node not found')
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canEditAcl(role)) throw err('Only owner can set trustees')

  await ensureDb()
  const existing = await db().queryDocs({
    collection: ACL,
    filters: [{ field: 'nodeId', operator: '==', value: nodeId }],
    pagination: { limit: 200 },
  })
  if (!existing.success) throw (existing.error as Error) || err('list ACL failed')

  const ts = nowIso()
  const want = new Set(trusteeUserIds.filter((id) => id && id !== userId))
  const kept: FileCabinetAclEntry[] = []

  for (const row of existing.data || []) {
    const entry = mapAcl(unwrapDoc(row as Record<string, unknown>))
    if (entry.role === 'owner') {
      kept.push(entry)
      continue
    }
    if (want.has(entry.userId)) {
      kept.push(entry)
      want.delete(entry.userId)
    } else {
      await db().deleteDoc(ACL, entry.id)
    }
  }

  for (const trusteeId of want) {
    const id = randomUUID()
    const data = {
      nodeId,
      userId: trusteeId,
      role: 'trustee' as FileCabinetAclRole,
      createdAt: ts,
      updatedAt: ts,
    }
    await db().createDoc(ACL, data, { id })
    kept.push(mapAcl({ id, ...data }))
  }

  return kept
}

/** @deprecated Use setTrustees — kept as alias for older call sites. */
export async function setEditors(
  userId: string,
  nodeId: string,
  editorUserIds: string[],
): Promise<FileCabinetAclEntry[]> {
  return setTrustees(userId, nodeId, editorUserIds)
}

export async function renameNode(
  userId: string,
  id: string,
  newName: string,
): Promise<FileCabinetNode> {
  const name = newName.trim()
  if (!name) throw err('Name required')
  const node = await getNodeUnsafe(id)
  if (!node) throw err('Node not found')
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canOwnerMutate(role)) throw err('Only owner can rename')

  const parentPath = node.path.includes('/')
    ? node.path.slice(0, node.path.lastIndexOf('/'))
    : ''
  const nextPath = joinCabinetPath(parentPath, name)
  if (node.kind === 'dir') assertFolderDepthOk(nextPath)

  const ts = nowIso()
  await ensureDb()
  const updated = await db().updateDoc(NODES, id, {
    name,
    path: nextPath,
    updatedAt: ts,
  })
  if (!updated.success) throw (updated.error as Error) || err('rename failed')

  if (node.kind === 'dir') {
    await repathDescendants(userId, id, nextPath)
  }

  return { ...node, name, path: nextPath, updatedAt: ts }
}

export async function moveNode(
  userId: string,
  id: string,
  newParentId: string | null,
): Promise<FileCabinetNode> {
  const node = await getNodeUnsafe(id)
  if (!node) throw err('Node not found')
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canOwnerMutate(role)) throw err('Only owner can move')

  if (newParentId === id) throw err('Cannot move into itself')

  let parentPath = ''
  if (newParentId) {
    const parent = await getNode(userId, newParentId)
    if (!parent || parent.kind !== 'dir') throw err('Target folder not found')
    const parentRole = await resolveRoleForNode(parent, userId)
    if (!parentRole || !canOwnerMutate(parentRole)) throw err('Only owner can move here')
    // Prevent moving a folder into its own descendant
    if (parent.path === node.path || parent.path.startsWith(`${node.path}/`)) {
      throw err('Cannot move folder into its descendant')
    }
    parentPath = parent.path
  }

  const nextPath = joinCabinetPath(parentPath, node.name)
  if (node.kind === 'dir') {
    assertFolderDepthOk(nextPath)
    const subtreeExtra = await maxRelativeDirDepth(userId, id)
    if (cabinetPathDepth(nextPath) + subtreeExtra > 3) {
      throw err('Move would exceed max folder depth of 3')
    }
  }

  const ts = nowIso()
  await ensureDb()
  const updated = await db().updateDoc(NODES, id, {
    parentId: newParentId,
    path: nextPath,
    updatedAt: ts,
  })
  if (!updated.success) throw (updated.error as Error) || err('move failed')

  if (node.kind === 'dir') {
    await repathDescendants(userId, id, nextPath)
  }

  return { ...node, parentId: newParentId, path: nextPath, updatedAt: ts }
}

/** Max folder depth relative to `rootId` (0 if no nested dirs). */
async function maxRelativeDirDepth(userId: string, rootId: string): Promise<number> {
  let max = 0
  const walk = async (id: string, depth: number) => {
    const children = await listChildren(userId, id)
    for (const child of children) {
      if (child.kind === 'dir') {
        max = Math.max(max, depth + 1)
        await walk(child.id, depth + 1)
      }
    }
  }
  await walk(rootId, 0)
  return max
}

async function repathDescendants(
  userId: string,
  parentId: string,
  parentPath: string,
): Promise<void> {
  const children = await listChildren(userId, parentId)
  const ts = nowIso()
  for (const child of children) {
    const nextPath = joinCabinetPath(parentPath, child.name)
    if (child.kind === 'dir') assertFolderDepthOk(nextPath)
    await db().updateDoc(NODES, child.id, { path: nextPath, updatedAt: ts })
    if (child.kind === 'dir') {
      await repathDescendants(userId, child.id, nextPath)
    }
  }
}

export async function getBreadcrumb(
  userId: string,
  folderId: string | null,
): Promise<FileCabinetNode[]> {
  if (!folderId) return []
  const chain: FileCabinetNode[] = []
  let current = await getNode(userId, folderId)
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    chain.unshift(current)
    if (!current.parentId) break
    current = await getNodeUnsafe(current.parentId)
    if (current) {
      const role = await resolveRoleForNode(current, userId)
      if (!role || !canRead(role)) break
    }
  }
  return chain
}

/** Owned image/video files at any folder depth (gallery candidates). */
export async function listOwnedMediaFiles(userId: string): Promise<FileCabinetNode[]> {
  await ensureDb()
  const result = await db().queryDocs({
    collection: NODES,
    filters: [{ field: 'ownerId', operator: '==', value: userId }],
    pagination: { limit: 500 },
  })
  if (!result.success) throw (result.error as Error) || err('listOwnedMedia failed')
  return (result.data || [])
    .map((d) => mapNode(unwrapDoc(d as Record<string, unknown>)))
    .filter(
      (n) =>
        n.kind === 'file' &&
        (n.mime?.startsWith('image/') || n.mime?.startsWith('video/')),
    )
}

export async function listAcl(userId: string, nodeId: string): Promise<FileCabinetAclEntry[]> {
  const node = await getNodeUnsafe(nodeId)
  if (!node) throw err('Node not found')
  const role = await resolveRoleForNode(node, userId)
  if (!role || !canRead(role)) throw err('Access denied')

  await ensureDb()

  const loadAclFor = async (id: string): Promise<FileCabinetAclEntry[]> => {
    const result = await db().queryDocs({
      collection: ACL,
      filters: [{ field: 'nodeId', operator: '==', value: id }],
      pagination: { limit: 200 },
    })
    if (!result.success) throw (result.error as Error) || err('listAcl failed')
    return (result.data || []).map((d) => mapAcl(unwrapDoc(d as Record<string, unknown>)))
  }

  const direct = await loadAclFor(nodeId)
  const directTrustees = direct.filter((e) => e.role === 'trustee')
  if (directTrustees.length > 0) return direct

  // Inherited share: trustees live on an ancestor folder — surface those for the options row
  let current: FileCabinetNode | null = node
  const seen = new Set<string>([node.id])
  while (current?.parentId) {
    if (seen.has(current.parentId)) break
    seen.add(current.parentId)
    current = await getNodeUnsafe(current.parentId)
    if (!current) break
    const ancestorAcl = await loadAclFor(current.id)
    const trustees = ancestorAcl.filter((e) => e.role === 'trustee')
    if (trustees.length > 0) {
      const owners = direct.filter((e) => e.role === 'owner')
      const ancestorOwners = ancestorAcl.filter((e) => e.role === 'owner')
      return [...(owners.length ? owners : ancestorOwners), ...trustees]
    }
  }

  return direct
}

export async function getDesktop(
  userId: string,
  scope: FileCabinetDesktopScope,
): Promise<FileCabinetDesktop> {
  await ensureDb()
  const result = await db().findOneDoc(DESKTOP, [
    { field: 'userId', operator: '==', value: userId },
    { field: 'scope', operator: '==', value: scope },
  ])
  if (!result.success) throw (result.error as Error) || err('getDesktop failed')
  if (result.data) return mapDesktop(unwrapDoc(result.data))

  const ts = nowIso()
  return {
    id: '',
    userId,
    scope,
    icons: [],
    treeExpandedIds: [],
    updatedAt: ts,
  }
}

export async function saveDesktop(
  userId: string,
  scope: FileCabinetDesktopScope,
  icons: FileCabinetDesktopIcon[],
  opts?: { treeExpandedIds?: string[] },
): Promise<FileCabinetDesktop> {
  await ensureDb()
  const ts = nowIso()
  const existing = await db().findOneDoc(DESKTOP, [
    { field: 'userId', operator: '==', value: userId },
    { field: 'scope', operator: '==', value: scope },
  ])
  if (!existing.success) throw (existing.error as Error) || err('saveDesktop lookup failed')

  const prev = existing.data ? mapDesktop(unwrapDoc(existing.data)) : null
  const treeExpandedIds =
    opts?.treeExpandedIds !== undefined
      ? opts.treeExpandedIds
      : prev?.treeExpandedIds || []

  const payload = {
    userId,
    scope,
    icons,
    treeExpandedIds,
    updatedAt: ts,
  }

  let id: string
  if (existing.data) {
    const mapped = mapDesktop(unwrapDoc(existing.data))
    id = mapped.id
    const updated = await db().updateDoc(DESKTOP, id, payload)
    if (!updated.success) throw (updated.error as Error) || err('saveDesktop update failed')
  } else {
    id = randomUUID()
    const created = await db().createDoc(
      DESKTOP,
      { ...payload, createdAt: ts },
      { id },
    )
    if (!created.success) throw (created.error as Error) || err('saveDesktop create failed')
  }

  const desktop: FileCabinetDesktop = {
    id,
    userId,
    scope,
    icons,
    treeExpandedIds,
    updatedAt: ts,
  }
  await publishToUserTunnel(userId, FILE_CABINET_DESKTOP_CHANNEL, {
    scope,
    icons,
    treeExpandedIds,
    updatedAt: ts,
  })
  return desktop
}

export async function listGalleryItems(ownerId: string): Promise<FileCabinetGalleryItem[]> {
  await ensureDb()
  const result = await db().queryDocs({
    collection: GALLERY,
    filters: [{ field: 'ownerId', operator: '==', value: ownerId }],
    orderBy: [{ field: 'sortOrder', direction: 'asc' }],
    pagination: { limit: 200 },
  })
  if (!result.success) throw (result.error as Error) || err('listGallery failed')
  return (result.data || []).map((d) => mapGalleryItem(unwrapDoc(d as Record<string, unknown>)))
}

export async function listPublicGalleryByOwner(
  ownerId: string,
): Promise<FileCabinetGalleryItem[]> {
  const items = await listGalleryItems(ownerId)
  return items.filter((i) => i.visibility === 'public')
}

export async function addGalleryItem(
  userId: string,
  input: {
    nodeId: string
    visibility?: FileCabinetGalleryVisibility
    caption?: string
    sortOrder?: number
  },
): Promise<FileCabinetGalleryItem> {
  const node = await getNodeUnsafe(input.nodeId)
  if (!node || node.ownerId !== userId) throw err('Only owner can add gallery items')
  if (node.kind !== 'file') throw err('Gallery items must be files')
  if (!node.mime?.startsWith('image/') && !node.mime?.startsWith('video/')) {
    throw err('Gallery supports image/video MIME only')
  }

  const ts = nowIso()
  const id = randomUUID()
  const data = {
    ownerId: userId,
    nodeId: node.id,
    sortOrder: input.sortOrder ?? Date.now(),
    visibility: input.visibility ?? 'private',
    caption: input.caption,
    storageUrl: node.storageUrl,
    mime: node.mime,
    name: node.name,
    createdAt: ts,
    updatedAt: ts,
  }
  await ensureDb()
  const created = await db().createDoc(GALLERY, data, { id })
  if (!created.success) throw (created.error as Error) || err('addGalleryItem failed')
  return mapGalleryItem({ id, ...data })
}

export async function updateGalleryItem(
  userId: string,
  id: string,
  patch: Partial<{
    visibility: FileCabinetGalleryVisibility
    caption: string
    sortOrder: number
  }>,
): Promise<FileCabinetGalleryItem> {
  await ensureDb()
  const result = await db().readDoc(GALLERY, id)
  if (!result.success || !result.data) throw err('Gallery item not found')
  const item = mapGalleryItem(unwrapDoc(result.data))
  if (item.ownerId !== userId) throw err('Access denied')

  const next = {
    ...item,
    ...patch,
    updatedAt: nowIso(),
  }
  const updated = await db().updateDoc(GALLERY, id, {
    visibility: next.visibility,
    caption: next.caption,
    sortOrder: next.sortOrder,
    updatedAt: next.updatedAt,
  })
  if (!updated.success) throw (updated.error as Error) || err('updateGalleryItem failed')
  return next
}

export async function removeGalleryItem(userId: string, id: string): Promise<void> {
  await ensureDb()
  const result = await db().readDoc(GALLERY, id)
  if (!result.success || !result.data) return
  const item = mapGalleryItem(unwrapDoc(result.data))
  if (item.ownerId !== userId) throw err('Access denied')
  await db().deleteDoc(GALLERY, id)
}
