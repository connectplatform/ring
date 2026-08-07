import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { randomUUID } from 'node:crypto'
import { fileService } from '@/lib/file'
import { logger } from '@/lib/logger'
import * as FileCabinet from '@/features/file-cabinet/service'
import type { FileCabinetNode } from '@/features/file-cabinet/types'
import type { WebProductImageCandidate } from '@/lib/web'

const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_REMOTE_REDIRECTS = 3
const REMOTE_FETCH_TIMEOUT_MS = 15_000

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

export interface ProductResearchMediaRef {
  id: string
  runId: string
  cabinetNodeId: string
  cabinetPath: string
  storageUrl: string
  storageFileId?: string
  sourceUrl: string
  alt: string
  rationale?: string
  mime: string
  name: string
  createdAt: string
}

export interface ProductResearchArtifacts {
  runId: string
  cabinetPath: string
  markdownNodeId?: string
  media: ProductResearchMediaRef[]
  skipped: Array<{ imageUrl: string; reason: string }>
}

function slugSegment(value: string, fallback: string): string {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  )
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true
}

async function assertPublicRemoteUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) image URLs are allowed')
  }
  if (url.username || url.password) {
    throw new Error('Authenticated image URLs are not allowed')
  }
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private image host is not allowed')
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private image address is not allowed')
    return url
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error('Image host resolves to a private address')
  }
  return url
}

async function readResponseWithLimit(response: Response): Promise<Buffer> {
  if (!response.body) throw new Error('Image response has no body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REMOTE_IMAGE_BYTES) {
        await reader.cancel()
        throw new Error('Remote image exceeds 12MB')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
}

async function fetchRemoteImage(
  rawUrl: string,
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let url = await assertPublicRemoteUrl(rawUrl)

  for (let redirect = 0; redirect <= MAX_REMOTE_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg;q=0.9',
        'User-Agent': 'Ring-WebConductor/1.0',
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirect === MAX_REMOTE_REDIRECTS) {
        throw new Error('Too many image redirects')
      }
      url = await assertPublicRemoteUrl(new URL(location, url).toString())
      continue
    }

    if (!response.ok) throw new Error(`Image fetch failed (${response.status})`)
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || ''
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new Error(`Unsupported remote image type: ${contentType || 'unknown'}`)
    }
    const declaredSize = Number(response.headers.get('content-length') || 0)
    if (declaredSize > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error('Remote image exceeds 12MB')
    }
    return {
      buffer: await readResponseWithLimit(response),
      contentType,
      finalUrl: url.toString(),
    }
  }

  throw new Error('Image download failed')
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/avif') return 'avif'
  return 'jpg'
}

async function ensureChildDir(
  ownerUserId: string,
  parentId: string | null,
  name: string,
): Promise<FileCabinetNode> {
  const children = await FileCabinet.listChildren(ownerUserId, parentId, { ownerOnly: true })
  const existing = children.find(
    (node) => node.kind === 'dir' && node.name.toLowerCase() === name.toLowerCase(),
  )
  if (existing) return existing
  return FileCabinet.createDir(ownerUserId, { name, parentId })
}

async function ensureProductAltFolder(input: {
  ownerUserId: string
  storeName: string
  productSlug: string
}): Promise<FileCabinetNode> {
  // Cabinet root is the conceptual `files/` root. Three persisted levels fit MAX_FOLDER_DEPTH=3.
  const store = await ensureChildDir(
    input.ownerUserId,
    null,
    slugSegment(input.storeName, 'store'),
  )
  const product = await ensureChildDir(
    input.ownerUserId,
    store.id,
    slugSegment(input.productSlug, 'product'),
  )
  return ensureChildDir(input.ownerUserId, product.id, 'alt')
}

async function saveResearchMarkdown(input: {
  ownerUserId: string
  parentId: string
  runId: string
  markdown: string
  citations: string[]
}): Promise<FileCabinetNode | null> {
  const body = [
    `# Product web research — ${input.runId}`,
    '',
    input.markdown.trim(),
    '',
    '## Sources',
    ...(input.citations.length ? input.citations.map((url) => `- ${url}`) : ['- (none)']),
    '',
  ].join('\n')
  const buffer = Buffer.from(body, 'utf8')
  const name = `research-${input.runId}.md`
  const uploaded = await fileService.upload(name, buffer, {
    access: 'private',
    contentType: 'text/markdown; charset=utf-8',
    ringbaseType: 'document',
    derivativesProfile: 'none',
  })
  if (!uploaded.success || !uploaded.url) {
    logger.warn('[product-cabinet-media] research markdown upload failed', {
      error: uploaded.error,
    })
    return null
  }
  return FileCabinet.createFileNode(input.ownerUserId, {
    name,
    parentId: input.parentId,
    storageUrl: uploaded.url,
    storageFileId: uploaded.fileId,
    mime: uploaded.contentType || 'text/markdown',
    size: uploaded.size || buffer.length,
  })
}

export async function saveProductResearchArtifacts(input: {
  ownerUserId: string
  storeName: string
  productSlug: string
  markdown: string
  citations: string[]
  imageCandidates: WebProductImageCandidate[]
  maxImages?: number
}): Promise<ProductResearchArtifacts> {
  if (!input.ownerUserId) throw new Error('Cabinet owner is required')
  const altFolder = await ensureProductAltFolder(input)
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${randomUUID().slice(0, 8)}`
  const cabinetPath = `files/${altFolder.path}`
  const markdownNode = await saveResearchMarkdown({
    ownerUserId: input.ownerUserId,
    parentId: altFolder.id,
    runId,
    markdown: input.markdown,
    citations: input.citations,
  })

  const media: ProductResearchMediaRef[] = []
  const skipped: Array<{ imageUrl: string; reason: string }> = []
  const candidates = input.imageCandidates.slice(0, Math.max(0, input.maxImages ?? 5))

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    try {
      const remote = await fetchRemoteImage(candidate.imageUrl)
      const name = `research-${runId}-${index + 1}.${extensionFor(remote.contentType)}`
      const uploaded = await fileService.upload(name, remote.buffer, {
        // Public product-ready asset, but discovery/organization remains cabinet ACL-controlled.
        access: 'public',
        contentType: remote.contentType,
        ringbaseType: 'image',
        derivativesProfile: 'gallery',
      })
      if (!uploaded.success || !uploaded.url) {
        throw new Error(uploaded.error || 'RingBase upload failed')
      }
      const node = await FileCabinet.createFileNode(input.ownerUserId, {
        name,
        parentId: altFolder.id,
        storageUrl: uploaded.url,
        storageFileId: uploaded.fileId,
        mime: uploaded.contentType || remote.contentType,
        size: uploaded.size || remote.buffer.length,
      })
      media.push({
        id: randomUUID(),
        runId,
        cabinetNodeId: node.id,
        cabinetPath: node.path,
        storageUrl: uploaded.url,
        storageFileId: uploaded.fileId,
        sourceUrl: candidate.sourceUrl || remote.finalUrl,
        alt: candidate.alt,
        rationale: candidate.rationale,
        mime: uploaded.contentType || remote.contentType,
        name,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Image import failed'
      skipped.push({ imageUrl: candidate.imageUrl, reason })
      logger.warn('[product-cabinet-media] image skipped', {
        imageUrl: candidate.imageUrl,
        reason,
      })
    }
  }

  return {
    runId,
    cabinetPath,
    markdownNodeId: markdownNode?.id,
    media,
    skipped,
  }
}
