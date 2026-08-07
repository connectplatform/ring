'use server'

import { auth } from '@/auth'
import { hasMemberPrivileges, isPlatformAdmin, resolveSessionUserRole } from '@/features/auth/user-role'
import type { GenerativeMediaScope } from '@/features/generative-media/types'
import { deriveWebpSibling } from '@/lib/images/derive-webp'

// maxDuration for long VideoConductor polls must live on route segment configs —
// "use server" modules may only export async functions (Turbopack).

async function requireActor(requireMember = false) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const role = resolveSessionUserRole(session.user.role as string)
  if (requireMember && !hasMemberPrivileges(role) && !isPlatformAdmin(role)) {
    return { error: 'Member privileges required' as const }
  }
  return { session, role }
}

function serializeMessages(
  messages: Array<{
    id: string
    senderId: string
    senderName: string
    content: string
    type: string
    timestamp: string | Date
    attachments?: Array<{ url: string; name: string; type: string }>
  }>,
) {
  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    content: m.content,
    type: m.type,
    timestamp:
      typeof m.timestamp === 'string'
        ? m.timestamp
        : m.timestamp instanceof Date
          ? m.timestamp.toISOString()
          : new Date().toISOString(),
    attachments: m.attachments?.map((a) => ({
      url: a.url,
      name: a.name,
      type: a.type,
    })),
  }))
}

export async function listGenMediaMessagesAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
}) {
  const gate = await requireActor()
  if ('error' in gate) return { success: false as const, error: gate.error }

  const { listGenMediaMessages } = await import('@/features/generative-media/service')
  const { conversationId, messages } = await listGenMediaMessages({
    userId: gate.session.user!.id!,
    ...input,
  })
  return {
    success: true as const,
    conversationId,
    messages: serializeMessages(messages),
  }
}

export async function runGenMediaImageAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  purpose?: string
  referenceImageUrls?: string[]
  notifyIfBackground?: boolean
  actionUrl?: string
}) {
  const gate = await requireActor(input.scope === 'nft' || input.scope === 'cabinet')
  if ('error' in gate) return { success: false as const, error: gate.error }

  const { runGenMediaImageTurn } = await import('@/features/generative-media/service')
  return runGenMediaImageTurn({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    ...input,
  })
}

export async function runGenMediaVideoAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  purpose?: string
  imageUrl?: string
  referenceImageUrls?: string[]
  notifyIfBackground?: boolean
  actionUrl?: string
}) {
  const gate = await requireActor(input.scope === 'nft' || input.scope === 'cabinet')
  if ('error' in gate) return { success: false as const, error: gate.error }

  const { runGenMediaVideoTurn } = await import('@/features/generative-media/service')
  return runGenMediaVideoTurn({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    ...input,
  })
}

export async function startGenMediaVideoAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  purpose?: string
  imageUrl?: string
  referenceImageUrls?: string[]
  notifyIfBackground?: boolean
  actionUrl?: string
}) {
  const gate = await requireActor(input.scope === 'nft' || input.scope === 'cabinet')
  if ('error' in gate) return { success: false as const, error: gate.error }

  const { startGenMediaVideoJob } = await import('@/features/generative-media/service')
  return startGenMediaVideoJob({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    ...input,
  })
}

export async function pollGenMediaVideoJobAction(input: { jobId: string }) {
  const gate = await requireActor()
  if ('error' in gate) return { success: false as const, error: gate.error }
  const jobId = input.jobId?.trim()
  if (!jobId) return { success: false as const, error: 'jobId required' }

  const { pollGenMediaVideoJob } = await import('@/features/generative-media/service')
  return pollGenMediaVideoJob({
    userId: gate.session.user!.id!,
    jobId,
  })
}

export async function cancelGenMediaVideoJobAction(input: { jobId: string }) {
  const gate = await requireActor()
  if ('error' in gate) return { success: false as const, error: gate.error }
  const jobId = input.jobId?.trim()
  if (!jobId) return { success: false as const, error: 'jobId required' }

  const { cancelGenMediaVideoJob } = await import('@/features/generative-media/service')
  return cancelGenMediaVideoJob({
    userId: gate.session.user!.id!,
    jobId,
  })
}

export async function runGhostWriteAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  draft: string
  context?: {
    name?: string
    category?: string
    description?: string
    vendorName?: string
  }
}) {
  const gate = await requireActor(input.scope === 'nft' || input.scope === 'cabinet')
  if ('error' in gate) return { success: false as const, error: gate.error }

  const { runGhostWrite } = await import('@/features/generative-media/service')
  return runGhostWrite({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    ...input,
  })
}

export async function postGenMediaUploadAction(input: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  url: string
  contentType?: string
  fileName?: string
  deriveWebp?: boolean
  fileId?: string
  derivatives?: import('@/lib/file/interfaces/IFileService').MediaDerivatives
}) {
  const gate = await requireActor(input.scope === 'nft' || input.scope === 'cabinet')
  if ('error' in gate) return { success: false as const, error: gate.error }

  let webpUrl: string | undefined
  let derivatives = input.derivatives
  let fileId = input.fileId

  if (input.derivatives && Object.keys(input.derivatives).length > 0) {
    webpUrl =
      input.derivatives.original_webp ||
      input.derivatives.thumb ||
      input.derivatives.mobile
  } else if (input.deriveWebp !== false) {
    const webp = await deriveWebpSibling({
      sourceUrl: input.url,
      contentType: input.contentType,
      purpose: `genmedia-${input.fieldId}`,
      fileId: input.fileId,
      existingDerivatives: input.derivatives,
    })
    webpUrl = webp.webpUrl
    derivatives = webp.derivatives || derivatives
    fileId = webp.fileId || fileId
  }

  const { postUploadToGenMediaChat } = await import('@/features/generative-media/service')
  const posted = await postUploadToGenMediaChat({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    scope: input.scope,
    pageSlug: input.pageSlug,
    fieldId: input.fieldId,
    entityId: input.entityId,
    url: input.url,
    webpUrl,
    contentType: input.contentType,
    fileName: input.fileName,
  })

  return {
    ...posted,
    webpUrl,
    derivatives,
    fileId,
  }
}

export async function deleteGenMediaFileAction(input: { url: string }) {
  const gate = await requireActor()
  if ('error' in gate) return { success: false as const, error: gate.error }
  const url = input.url?.trim()
  if (!url) return { success: false as const, error: 'URL required' }
  try {
    const { file } = await import('@/lib/file')
    const result = await file().delete(url)
    if (!result.success) return { success: false as const, error: result.error || 'Delete failed' }
    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Delete failed',
    }
  }
}
