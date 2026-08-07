'use server'

import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { auth } from '@/auth'
import { hasMemberPrivileges, hasRoleAtLeast, UserRolesArray } from '@/features/auth/user-role'
import { file as fileService } from '@/lib/file'
import { getCabinetStorageConfig, validateFile } from '@/lib/storage/storage-config'
import * as FileCabinet from '@/features/file-cabinet/service'
import { fetchCabinetUpstream } from '@/features/file-cabinet/download-upstream'
import type {
  FileCabinetDesktopIcon,
  FileCabinetDesktopScope,
  FileCabinetGalleryVisibility,
} from '@/features/file-cabinet/types'

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Authentication required')
  return session
}

async function requireMember() {
  const session = await requireUser()
  if (!hasMemberPrivileges(session.user.role)) {
    throw new Error('Member privileges required')
  }
  return session
}

async function requireSubscriber() {
  const session = await requireUser()
  if (!hasRoleAtLeast(session.user.role, UserRolesArray.subscriber)) {
    throw new Error('Subscriber access required')
  }
  return session
}

export async function listOwnCabinetAction(parentId?: string | null) {
  const session = await requireMember()
  return FileCabinet.listChildren(session.user.id, parentId ?? null, { ownerOnly: true })
}

/** List children for any ACL-readable folder (owner or trustee). */
export async function listCabinetChildrenAction(parentId: string | null) {
  const session = await requireSubscriber()
  return FileCabinet.listChildren(session.user.id, parentId)
}

export async function listSharedCabinetAction() {
  const session = await requireSubscriber()
  return FileCabinet.listSharedWithMe(session.user.id)
}

export async function getCabinetBreadcrumbAction(folderId: string | null) {
  const session = await requireUser()
  return FileCabinet.getBreadcrumb(session.user.id, folderId)
}

export async function createFolderAction(name: string, parentId?: string | null) {
  const session = await requireMember()
  const node = await FileCabinet.createDir(session.user.id, { name, parentId })
  revalidatePath('/file-cabinet')
  return node
}

export async function uploadCabinetFileAction(
  formData: FormData,
): Promise<{ ok: true; node: Awaited<ReturnType<typeof FileCabinet.createFileNode>> } | { ok: false; error: string }> {
  try {
    const session = await requireMember()
    const file = formData.get('file')
    const parentIdRaw = formData.get('parentId')
    const parentId =
      typeof parentIdRaw === 'string' && parentIdRaw.length > 0 ? parentIdRaw : null

    if (!(file instanceof File)) return { ok: false, error: 'file required' }

    const config = getCabinetStorageConfig()
    const validation = validateFile(file, config)
    if (!validation.valid) return { ok: false, error: validation.error || 'Invalid file' }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await fileService().upload(file.name, buffer, {
      access: 'private',
      contentType: file.type,
      ringbaseType: file.type.startsWith('image/') ? 'image' : 'document',
      derivativesProfile: file.type.startsWith('image/') ? 'gallery' : 'none',
    })
    if (!uploaded.success || !uploaded.url) {
      return { ok: false, error: uploaded.error || 'Upload failed' }
    }

    const node = await FileCabinet.createFileNode(session.user.id, {
      name: file.name,
      parentId,
      storageUrl: uploaded.url,
      storageFileId: uploaded.fileId,
      mime: uploaded.contentType || file.type,
      size: uploaded.size || file.size,
    })
    revalidatePath('/file-cabinet')
    return { ok: true, node }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed' }
  }
}

export async function deleteCabinetNodeAction(nodeId: string) {
  const session = await requireMember()
  const node = await FileCabinet.getNode(session.user.id, nodeId)
  if (node?.storageUrl) {
    await fileService().delete(node.storageUrl)
  }
  await FileCabinet.deleteNode(session.user.id, nodeId)
  revalidatePath('/file-cabinet')
  revalidatePath('/profile/shared')
  return { ok: true as const }
}

export async function renameCabinetNodeAction(nodeId: string, name: string) {
  const session = await requireMember()
  const node = await FileCabinet.renameNode(session.user.id, nodeId, name)
  // Keep desktop visible-filename meta in sync (overwrite; no rename history)
  try {
    const desktop = await FileCabinet.getDesktop(session.user.id, 'own')
    const next = desktop.icons.map((ic) =>
      ic.nodeId === nodeId
        ? { ...ic, label: node.name, meta: { ...ic.meta, filename: node.name } }
        : ic,
    )
    if (next.some((ic, i) => ic !== desktop.icons[i])) {
      await FileCabinet.saveDesktop(session.user.id, 'own', next)
    }
  } catch {
    /* non-fatal — node rename already committed */
  }
  revalidatePath('/file-cabinet')
  return node
}

export async function moveCabinetNodeAction(nodeId: string, newParentId: string | null) {
  const session = await requireMember()
  const node = await FileCabinet.moveNode(session.user.id, nodeId, newParentId)
  revalidatePath('/file-cabinet')
  return node
}

export async function setCabinetTrusteesAction(nodeId: string, trusteeUserIds: string[]) {
  const session = await requireMember()
  const entries = await FileCabinet.setTrustees(session.user.id, nodeId, trusteeUserIds)
  revalidatePath('/file-cabinet')
  revalidatePath('/profile/shared')
  return entries
}

/** @deprecated Prefer setCabinetTrusteesAction */
export async function setCabinetEditorsAction(nodeId: string, editorUserIds: string[]) {
  return setCabinetTrusteesAction(nodeId, editorUserIds)
}

export async function listCabinetAclAction(nodeId: string) {
  const session = await requireUser()
  return FileCabinet.listAcl(session.user.id, nodeId)
}

export async function listCabinetFolderTreeAction(scope: FileCabinetDesktopScope) {
  const session = await requireSubscriber()
  if (scope === 'own' && !hasMemberPrivileges(session.user.role)) {
    throw new Error('Member privileges required for own desktop')
  }
  return FileCabinet.listFolderTree(session.user.id, scope)
}

export async function getDesktopAction(scope: FileCabinetDesktopScope) {
  const session = await requireSubscriber()
  if (scope === 'own' && !hasMemberPrivileges(session.user.role)) {
    throw new Error('Member privileges required for own desktop')
  }
  return FileCabinet.getDesktop(session.user.id, scope)
}

export async function saveDesktopAction(
  scope: FileCabinetDesktopScope,
  icons: FileCabinetDesktopIcon[],
  opts?: { treeExpandedIds?: string[] },
) {
  const session = await requireSubscriber()
  if (scope === 'own' && !hasMemberPrivileges(session.user.role)) {
    throw new Error('Member privileges required for own desktop')
  }
  return FileCabinet.saveDesktop(session.user.id, scope, icons, opts)
}

export async function listGalleryAction() {
  const session = await requireUser()
  return FileCabinet.listGalleryItems(session.user.id)
}

export async function listGalleryCandidatesAction() {
  const session = await requireMember()
  return FileCabinet.listOwnedMediaFiles(session.user.id)
}

export async function addGalleryItemAction(
  nodeId: string,
  visibility: FileCabinetGalleryVisibility = 'private',
  caption?: string,
) {
  const session = await requireMember()
  const item = await FileCabinet.addGalleryItem(session.user.id, {
    nodeId,
    visibility,
    caption,
  })
  revalidatePath('/profile/gallery')
  return item
}

export async function updateGalleryItemAction(
  id: string,
  patch: Partial<{ visibility: FileCabinetGalleryVisibility; caption: string; sortOrder: number }>,
) {
  const session = await requireMember()
  const item = await FileCabinet.updateGalleryItem(session.user.id, id, patch)
  revalidatePath('/profile/gallery')
  return item
}

export async function removeGalleryItemAction(id: string) {
  const session = await requireMember()
  await FileCabinet.removeGalleryItem(session.user.id, id)
  revalidatePath('/profile/gallery')
  return { ok: true as const }
}

export type CabinetImageMeta = {
  width?: number
  height?: number
  format?: string
  space?: string
  hasAlpha?: boolean
  orientation?: number
  density?: number
  exif?: Record<string, string>
}

export async function getCabinetImageMetaAction(nodeId: string): Promise<CabinetImageMeta | null> {
  const session = await requireUser()
  const node = await FileCabinet.getNode(session.user.id, nodeId)
  if (!node?.mime?.startsWith('image/')) return null

  const { response } = await fetchCabinetUpstream(node)
  const buf = Buffer.from(await response.arrayBuffer())
  const meta = await sharp(buf).metadata()

  const exif: Record<string, string> = {}
  if (meta.exif) {
    // Expose a few common IFD0-ish fields when sharp parses them via withMetadata path;
    // raw EXIF buffer length is useful even when tags aren't decoded.
    exif.exifBytes = String(meta.exif.byteLength)
  }

  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    space: meta.space,
    hasAlpha: meta.hasAlpha,
    orientation: meta.orientation,
    density: meta.density,
    exif: Object.keys(exif).length ? exif : undefined,
  }
}

export type CabinetStorageMeta = {
  createdAt?: string
  updatedAt?: string
  originalFilename?: string
  size?: number
  contentType?: string
}

/** Timestamps / original name from RingFileBase metadata API (fallback: node DB fields). */
export async function getCabinetStorageMetaAction(
  nodeId: string,
): Promise<CabinetStorageMeta | null> {
  const session = await requireUser()
  const node = await FileCabinet.getNode(session.user.id, nodeId)
  if (!node) return null

  const base: CabinetStorageMeta = {
    createdAt: node.createdAt || undefined,
    updatedAt: node.updatedAt || undefined,
    originalFilename: node.name || undefined,
    size: node.size,
    contentType: node.mime,
  }

  if (!node.storageUrl) return base

  try {
    const meta = await fileService().getMetadata(node.storageUrl)
    if (!meta) return base
    return {
      createdAt: meta.uploadedAt || base.createdAt,
      updatedAt: meta.uploadedAt || base.updatedAt,
      originalFilename: meta.filename || base.originalFilename,
      size: meta.size ?? base.size,
      contentType: meta.contentType || base.contentType,
    }
  } catch {
    return base
  }
}

export type CabinetTrusteeProfile = {
  id: string
  name: string
  image?: string | null
}

export async function getCabinetTrusteeProfilesAction(
  userIds: string[],
): Promise<CabinetTrusteeProfile[]> {
  await requireUser()
  const unique = [...new Set(userIds.filter(Boolean))].slice(0, 24)
  if (unique.length === 0) return []

  // CRM resolve-users: Layer1 stub (no-op chips) or overlay full impl
  try {
    const { resolveCrmUserChips } = await import('@/features/crm/orders/resolve-users')
    const map = await resolveCrmUserChips(unique)
    return unique.map((id) => {
      const chip = map[id]
      return {
        id,
        name: chip?.name || id.slice(0, 8),
        image: chip?.photoURL ?? null,
      }
    })
  } catch {
    return unique.map((id) => ({ id, name: id.slice(0, 8), image: null }))
  }
}

/**
 * Persist a generated media URL into the File Cabinet (upload + createFileNode).
 * When parentId is null and addDesktopIcon, merge iconFromNode onto the own desktop.
 */
export async function saveGeneratedMediaToDesktopAction(input: {
  url: string
  name?: string
  mime?: string
  fileId?: string
  parentId?: string | null
  addDesktopIcon?: boolean
}) {
  const session = await requireMember()
  const url = input.url?.trim()
  if (!url) throw new Error('URL required')

  let buffer: Buffer
  let contentType = input.mime || 'application/octet-stream'
  let fileId = input.fileId

  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    if (comma < 0) throw new Error('Invalid data URI')
    const meta = url.slice(0, comma)
    const mimeMatch = meta.match(/^data:([^;]+)/)
    contentType = mimeMatch?.[1] || contentType
    buffer = Buffer.from(url.slice(comma + 1), 'base64')
  } else {
    const response = await fetch(url, { method: 'GET', cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to fetch media (${response.status})`)
    buffer = Buffer.from(await response.arrayBuffer())
    contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || contentType
  }

  const config = getCabinetStorageConfig()
  if (buffer.length > config.maxFileSize) {
    throw new Error(`File exceeds ${config.maxFileSize / (1024 * 1024)}MB limit`)
  }

  const ext =
    contentType.startsWith('video/')
      ? 'mp4'
      : contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
          ? 'webp'
          : contentType.includes('jpeg') || contentType.includes('jpg')
            ? 'jpg'
            : 'bin'
  const name =
    (input.name?.trim() || `generated-${Date.now()}.${ext}`).slice(0, 180)
  const parentId = input.parentId ?? null

  const uploaded = await fileService().upload(name, buffer, {
    access: 'private',
    contentType,
    ringbaseType: contentType.startsWith('image/')
      ? 'image'
      : contentType.startsWith('video/')
        ? 'media'
        : 'document',
    derivativesProfile: contentType.startsWith('image/') ? 'gallery' : 'none',
  })
  if (!uploaded.success || !uploaded.url) {
    throw new Error(uploaded.error || 'Upload failed')
  }
  fileId = uploaded.fileId || fileId

  const node = await FileCabinet.createFileNode(session.user.id, {
    name,
    parentId,
    storageUrl: uploaded.url,
    storageFileId: fileId,
    mime: uploaded.contentType || contentType,
    size: uploaded.size || buffer.length,
  })

  if (parentId == null && input.addDesktopIcon !== false) {
    const { iconFromNode } = await import('@/features/file-cabinet/desktop-filename')
    const desktop = await FileCabinet.getDesktop(session.user.id, 'own')
    const existing = desktop.icons.some((ic) => ic.nodeId === node.id)
    if (!existing) {
      const occupied = new Set(desktop.icons.map((ic) => `${ic.x},${ic.y}`))
      let x = 24
      let y = 24
      for (let i = 0; i < 64; i++) {
        const key = `${x},${y}`
        if (!occupied.has(key)) break
        x += 100
        if (x > 700) {
          x = 24
          y += 100
        }
      }
      await FileCabinet.saveDesktop(session.user.id, 'own', [
        ...desktop.icons,
        iconFromNode(node, { x, y }),
      ])
    }
  }

  revalidatePath('/file-cabinet')
  return node
}


