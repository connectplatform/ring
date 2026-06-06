import 'server-only'

import { auth } from '@/auth'
import {
  getProfileStorageConfig,
  getKYCStorageConfig,
  StorageConfig,
} from '@/lib/storage/storage-config'
import { file, getStorageBackendFromEnvironment } from '@/lib/file'
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { checkEntityOwnership } from '@/features/entities/utils/entity-utils'
import {
  getVendorEntity,
  getVendorEntityById,
} from '@/features/entities/services/vendor-entity'
import {
  UPLOAD_PURPOSES,
  type UploadScopeMetadata,
  type UnifiedUploadInput,
  type UnifiedUploadOutput,
  type NormalizedUploadResult,
  type UploadActorContext,
  type UploadPurpose,
  type UploadAuthMode,
} from '../upload-types'

type UploadFeatureKey = 'entities' | 'opportunities' | 'messaging' | 'admin'

interface UploadPolicy {
  purpose: UploadPurpose | string
  authMode: UploadAuthMode
  featureKey?: UploadFeatureKey
  maxSizeBytes: number
  allowedTypes: string[]
  requireScopeIds?: string[]
  requiresRole?: string[]
  keyBuilder: (params: UploadBuildParams) => Promise<string>
  authorize?: (params: UploadPolicyContext) => Promise<void>
}

interface UploadPolicyContext {
  file: File
  actor: UploadActorContext
  scope?: UploadScopeMetadata
  tenantPrefix: string
  meta: UnifiedUploadInput['meta']
}

interface UploadBuildParams extends UploadPolicyContext {}

type UploadFileValidation = {
  maxSizeBytes: number
  allowedTypes: string[]
}

interface UploadResultMetadata {
  scope?: UploadScopeMetadata
  fileType?: string
  fileCategory?: string
}

const DEFAULT_TENANT_SLUG = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring_platform'

const CHAT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-rar-compressed',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]

const OPPORTUNITY_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const VENDOR_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]

const REFMAGIC_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function buildTenantPrefix(tenantOverride?: string): string {
  const tenant = sanitizeSegment(tenantOverride || DEFAULT_TENANT_SLUG)
  return sanitizeSegment(tenant)
}

function sanitizeSegment(value: string | undefined | null, fallback = 'unknown'): string {
  if (!value) return fallback
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
  return safe || fallback
}

function sanitizeFileName(fileName: string): string {
  const trimmed = (fileName || 'upload.bin').replace(/^.+[\\/]/, '')
  return trimmed.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || `upload-${Date.now()}`
}

function sanitizeNameWithoutExtension(fileName: string): string {
  const safe = sanitizeFileName(fileName)
  const extensionIndex = safe.lastIndexOf('.')
  if (extensionIndex <= 0) {
    return safe
  }
  return safe.slice(0, extensionIndex)
}

function sanitizeExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx < 0 || idx === fileName.length - 1) {
    return ''
  }
  return sanitizeSegment(fileName.slice(idx + 1), 'bin')
}

function sanitizeFileType(fileType: string | undefined): string {
  return sanitizeSegment(fileType?.toLowerCase() || 'file', 'file')
}

function buildObjectId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return random.replace(/[^a-zA-Z0-9_-]/g, '')
}

function ensureUploadScope(meta: UnifiedUploadInput['meta']): UploadScopeMetadata {
  return {
    tenantSlug: meta.scope?.tenantSlug,
    conversationId: meta.scope?.conversationId,
    opportunityId: meta.scope?.opportunityId,
    entityId: meta.scope?.entityId || meta.scope?.vendorEntityId,
    vendorEntityId: meta.scope?.vendorEntityId,
    productId: meta.scope?.productId,
    mediaIndex: meta.scope?.mediaIndex,
    fileType: sanitizeFileType(meta.scope?.fileType || meta.fileType),
    fileCategory: sanitizeFileType(meta.scope?.fileCategory || meta.fileCategory),
  }
}

function normalizePurpose(purpose: string): UploadPurpose | string {
  return (UPLOAD_PURPOSES as readonly string[]).includes(purpose)
    ? (purpose as UploadPurpose)
    : purpose
}

function actorToRoles(roleValue: UploadActorContext['role']): string[] {
  if (!roleValue) return []
  return roleValue
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean)
}

function hasAllowedRole(actorRole: string[] | undefined, requiredRoles: string[]): boolean {
  if (!requiredRoles.length) return true
  return actorRole?.some((role) => requiredRoles.includes(role)) ?? false
}

function normalizeFileConfig(config: StorageConfig): UploadFileValidation {
  return {
    maxSizeBytes: config.maxFileSize,
    allowedTypes: config.allowedTypes,
  }
}

function normalizeValidation(
  config: UploadFileValidation | null,
  fallback: UploadFileValidation
): UploadFileValidation {
  if (!config) return fallback
  return {
    maxSizeBytes: config.maxSizeBytes || fallback.maxSizeBytes,
    allowedTypes: config.allowedTypes?.length ? config.allowedTypes : fallback.allowedTypes,
  }
}

function validateUploadInput(file: File, validation: UploadFileValidation): void {
  if (!file) {
    throw new Error('No file provided')
  }
  if (!file.size || file.size <= 0) {
    throw new Error('Uploaded file is empty')
  }
  if (file.size > validation.maxSizeBytes) {
    throw new Error(`File size exceeds maximum allowed size of ${validation.maxSizeBytes / (1024 * 1024)}MB`)
  }
  if (!validation.allowedTypes.includes(file.type) && !validation.allowedTypes.includes('*/*')) {
    throw new Error(`File type ${file.type || 'unknown'} is not allowed`)
  }
}

async function resolveActor(actorInput: UnifiedUploadInput['actor']): Promise<UploadActorContext> {
  if (actorInput?.userId) {
    return actorInput
  }
  const session = await auth()
  return {
    userId: session?.user?.id,
    role: session?.user?.role as string | undefined,
  }
}

async function ensureFeatureAllowed(featureKey: UploadFeatureKey | undefined, purpose: UploadPurpose | string): Promise<void> {
  if (!featureKey) return
  const isEnabled = isFeatureEnabledOnServer(featureKey)
  if (!isEnabled) {
    throw new Error(`Feature is disabled for uploads: ${purpose}`)
  }
}

async function assertConversationScope(actor: UploadActorContext, scope?: UploadScopeMetadata): Promise<void> {
  if (!scope?.conversationId) {
    throw new Error('conversationId is required for chat attachments')
  }
  const conversationService = new ConversationService()
  await conversationService.getConversationById(scope.conversationId, actor.userId as string)
}

async function assertEntityScope(actor: UploadActorContext, scope?: UploadScopeMetadata): Promise<void> {
  if (!scope?.entityId) {
    throw new Error('entityId is required for entity uploads')
  }
  const isOwner = await checkEntityOwnership(actor.userId as string, scope.entityId)
  if (!isOwner) {
    throw new Error('Forbidden: user does not own this entity')
  }
}

async function assertVendorScope(actor: UploadActorContext, scope?: UploadScopeMetadata): Promise<void> {
  if (!actor.userId) {
    throw new Error('Unauthorized')
  }
  if (scope?.vendorEntityId) {
    const vendorEntity = await getVendorEntityById(scope.vendorEntityId)
    if (!vendorEntity) {
      throw new Error('Vendor entity not found')
    }
    if ((vendorEntity as any).addedBy !== actor.userId) {
      throw new Error('Forbidden: cannot access this vendor entity')
    }
    return
  }
  const vendorEntity = await getVendorEntity(actor.userId)
  if (!vendorEntity) {
    throw new Error('Vendor access is required')
  }
}

function profileOrDefaultScope(scope: UploadScopeMetadata | undefined): UploadScopeMetadata {
  return {
    conversationId: scope?.conversationId,
    opportunityId: scope?.opportunityId,
    entityId: scope?.entityId,
    vendorEntityId: scope?.vendorEntityId,
    productId: scope?.productId,
    mediaIndex: scope?.mediaIndex,
    fileType: sanitizeFileType(scope?.fileType),
    fileCategory: sanitizeFileType(scope?.fileCategory),
  }
}

const policies: Record<string, UploadPolicy> = {
  'profile:avatar': {
    purpose: 'profile:avatar',
    authMode: 'authenticated',
    maxSizeBytes: normalizeFileConfig(getProfileStorageConfig()).maxSizeBytes,
    allowedTypes: normalizeFileConfig(getProfileStorageConfig()).allowedTypes,
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    keyBuilder: async ({ actor, scope, tenantPrefix, file, meta }) => {
      const safeFileType = sanitizeFileType(meta.fileType || scope?.fileType)
      const ext = sanitizeExtension(file.name)
      const suffix = buildObjectId()
      return `${tenantPrefix}/profile/${safeFileType}/${actor.userId || 'unknown'}_${Date.now()}_${suffix}.${ext || 'bin'}`
    },
  },
  'profile:kyc': {
    purpose: 'profile:kyc',
    authMode: 'authenticated',
    maxSizeBytes: normalizeFileConfig(getKYCStorageConfig()).maxSizeBytes,
    allowedTypes: normalizeFileConfig(getKYCStorageConfig()).allowedTypes,
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    keyBuilder: async ({ actor, scope, tenantPrefix, file }) => {
      const suffix = buildObjectId()
      const ext = sanitizeExtension(file.name)
      return `${tenantPrefix}/profile/kyc/${actor.userId || 'unknown'}_${Date.now()}_${suffix}.${ext || 'bin'}`
    },
  },
  'chat:attachment': {
    purpose: 'chat:attachment',
    authMode: 'authenticated',
    featureKey: 'messaging',
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    maxSizeBytes: 25 * 1024 * 1024,
    allowedTypes: CHAT_ALLOWED_TYPES,
    requireScopeIds: ['conversationId'],
    authorize: async ({ actor, scope }) => {
      await assertConversationScope(actor, scope)
    },
    keyBuilder: async ({ actor, scope, tenantPrefix, file }) => {
      const safeConv = sanitizeSegment(scope?.conversationId || 'general')
      const fileName = sanitizeNameWithoutExtension(file.name)
      const safeExt = sanitizeExtension(file.name)
      return `${tenantPrefix}/messaging/${safeConv}/${actor.userId || 'unknown'}_${Date.now()}_${sanitizeSegment(fileName)}.${safeExt || 'bin'}`
    },
  },
  'opportunity:cv': {
    purpose: 'opportunity:cv',
    authMode: 'authenticated',
    featureKey: 'opportunities',
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedTypes: OPPORTUNITY_ALLOWED_TYPES,
    keyBuilder: async ({ actor, scope, tenantPrefix, file }) => {
      const safeOpportunity = sanitizeSegment(scope?.opportunityId || 'opportunities')
      const fileName = sanitizeNameWithoutExtension(file.name)
      const ext = sanitizeExtension(file.name)
      const extensionSuffix = ext ? `.${ext}` : ''
      return `${tenantPrefix}/opportunities/${safeOpportunity}/${actor.userId || 'unknown'}_${Date.now()}_${sanitizeSegment(fileName)}${extensionSuffix}`
    },
  },
  'entity:logo': {
    purpose: 'entity:logo',
    authMode: 'authenticated',
    featureKey: 'entities',
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedTypes: [
      ...getKYCStorageConfig().allowedTypes,
      ...getProfileStorageConfig().allowedTypes,
    ],
    requireScopeIds: ['entityId'],
    authorize: async ({ actor, scope }) => {
      await assertEntityScope(actor, scope)
    },
    keyBuilder: async ({ actor, scope, tenantPrefix, file }) => {
      const entityId = sanitizeSegment(scope?.entityId || 'entity')
      const ext = sanitizeExtension(file.name)
      return `${tenantPrefix}/entities/${entityId}/${actor.userId || 'unknown'}_logo.${ext || 'png'}`
    },
  },
  'vendor:logo': {
    purpose: 'vendor:logo',
    authMode: 'authenticated',
    featureKey: 'entities',
    requiresRole: ['subscriber', 'confidential', 'admin', 'superadmin'],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    authorize: async ({ actor, scope }) => {
      await assertVendorScope(actor, scope)
    },
    keyBuilder: async ({ actor, scope, tenantPrefix, file }) => {
      const entityId = sanitizeSegment(scope?.vendorEntityId || scope?.entityId || 'vendor')
      const ext = sanitizeExtension(file.name)
      return `${tenantPrefix}/vendors/${entityId}/logo.${ext || 'png'}`
    },
  },
  'vendor:product-media': {
    purpose: 'vendor:product-media',
    authMode: 'authenticated',
    featureKey: 'entities',
    requiresRole: ['subscriber', 'confidential', 'admin', 'superadmin'],
    maxSizeBytes: 50 * 1024 * 1024,
    allowedTypes: VENDOR_ALLOWED_TYPES,
    requireScopeIds: ['productId'],
    authorize: async ({ actor, scope }) => {
      await assertVendorScope(actor, scope)
    },
    keyBuilder: async ({ actor, scope, tenantPrefix, file, meta }) => {
      const productId = sanitizeSegment(scope?.productId || 'product')
      const mediaType = sanitizeFileType(meta.fileType || scope?.fileType)
      const ext = sanitizeExtension(file.name)
      if (mediaType === 'video') {
        return `${tenantPrefix}/products/${productId}/video.${ext || 'mp4'}`
      }
      const index = sanitizeSegment(scope?.mediaIndex || '0', '0')
      return `${tenantPrefix}/products/${productId}/photo-${index}.${ext || 'png'}`
    },
  },
  'refmagic:temp-docx': {
    purpose: 'refmagic:temp-docx',
    authMode: 'public',
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: [REFMAGIC_DOCX_MIME],
    keyBuilder: async ({ actor, tenantPrefix, file }) => {
      const safeName = sanitizeSegment(buildObjectId())
      const ext = sanitizeExtension(file.name) || 'docx'
      return `refmagic/temp/${safeName}.${ext}`
    },
  },
  'refmagic:output-docx': {
    purpose: 'refmagic:output-docx',
    authMode: 'authenticated',
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: [REFMAGIC_DOCX_MIME],
    requiresRole: ['subscriber', 'member', 'confidential', 'admin', 'superadmin'],
    requireScopeIds: [],
    keyBuilder: async ({ actor, scope, file, meta }) => {
      if (!actor.userId) {
        throw new Error('Authenticated user required')
      }
      const providedName = sanitizeFileName(meta.fileName || file.name || 'output.docx')
      const safeBasename = sanitizeFileName(providedName).replace(/\.docx$/i, '')
      return `${sanitizeSegment('refmagic')}/outputs/${actor.userId}/${safeBasename}`
    },
  },
}

function assertRequiredRoles(requiredRoles: string[] | undefined, actorRoleValue: string | undefined): void {
  const actorRoles = actorToRoles(actorRoleValue)
  if (!hasAllowedRole(actorRoles, requiredRoles || [])) {
    throw new Error('Insufficient role to perform this upload')
  }
}

function assertScopeRequirements(policy: UploadPolicy, scope?: UploadScopeMetadata): void {
  if (!policy.requireScopeIds) return
  policy.requireScopeIds.forEach((scopeKey) => {
    if (!scope?.[scopeKey as keyof UploadScopeMetadata]) {
      throw new Error(`Missing required scope value: ${scopeKey}`)
    }
  })
}

function enrichMetadata(
  policy: UploadPolicy,
  file: File,
  meta: UnifiedUploadInput['meta'],
  scope?: UploadScopeMetadata
): UploadResultMetadata {
  return {
    scope: scope ? profileOrDefaultScope(scope) : undefined,
    fileType: sanitizeFileType(meta.fileType || scope?.fileType),
    fileCategory: sanitizeFileType(meta.fileCategory || scope?.fileCategory),
  }
}

async function executePolicy(
  meta: UploadPolicy,
  input: UnifiedUploadInput,
): Promise<UnifiedUploadOutput> {
  const scope = ensureUploadScope(input.meta)
  const tenantPrefix = buildTenantPrefix(input.tenantSlug || DEFAULT_TENANT_SLUG)

  const actor = await resolveActor(input.actor)
  if (meta.authMode === 'authenticated' && !actor.userId) {
    return {
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      reasonCode: 'AUTH_REQUIRED',
      scope,
    }
  }

  if (meta.requiresRole) {
    assertRequiredRoles(meta.requiresRole, actor.role)
  }

  await ensureFeatureAllowed(meta.featureKey, meta.purpose)
  assertScopeRequirements(meta, scope)

  if (meta.authorize) {
    await meta.authorize({ actor, file: input.file, scope, tenantPrefix, meta: input.meta })
  }

  const fileValidation = normalizeValidation(
    meta ? {
      maxSizeBytes: meta.maxSizeBytes,
      allowedTypes: meta.allowedTypes,
    } : null,
    normalizeFileConfig(getProfileStorageConfig()),
  )
  validateUploadInput(input.file, fileValidation)

  const objectKey = await meta.keyBuilder({
    actor,
    scope,
    tenantPrefix,
    file: input.file,
    meta: input.meta,
  })

  const uploadResult = await file().upload(objectKey, input.file, {
    access: 'public',
    addRandomSuffix: false,
    contentType: input.file.type || undefined,
  })

  if (!uploadResult.success) {
    return {
      success: false,
      statusCode: 500,
      error: uploadResult.error || 'Upload failed',
      reasonCode: 'UPLOAD_FAILED',
      scope,
    }
  }

  const responseMeta = enrichMetadata(meta, input.file, input.meta, scope)
  const now = uploadResult.uploadedAt || new Date().toISOString()
  const normalized: NormalizedUploadResult = {
    success: true,
    purpose: meta.purpose,
    url: uploadResult.url,
    downloadUrl: uploadResult.downloadUrl || uploadResult.url,
    filename: input.file.name,
    size: uploadResult.size ?? input.file.size,
    contentType: uploadResult.contentType || input.file.type || 'application/octet-stream',
    uploadedAt: now,
    provider: getStorageBackendFromEnvironment(),
    objectKey,
    ...responseMeta,
  }
  return normalized
}

export async function executeUnifiedUpload(input: UnifiedUploadInput): Promise<UnifiedUploadOutput> {
  try {
    const meta = input.meta
    const normalizedPurpose = normalizePurpose(meta.purpose)
    const policy = policies[normalizedPurpose]
    if (!policy) {
      return {
        success: false,
        statusCode: 400,
        error: `Unsupported upload purpose: ${meta.purpose}`,
        reasonCode: 'INVALID_PURPOSE',
      }
    }
    return await executePolicy(policy, input)
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const statusCode = message.includes('unauthorized') || message.includes('forbidden') ? 403 : 400
      return {
        success: false,
        statusCode,
        error: error.message,
        reasonCode: 'UPLOAD_REJECTED',
        scope: input.meta.scope,
      }
    }

    return {
      success: false,
      statusCode: 500,
      error: 'Unknown upload failure',
      reasonCode: 'UPLOAD_REJECTED',
      scope: input.meta.scope,
    }
  }
}
