import 'server-only'

import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Conversation, Message } from '@/features/chat/types'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import { TextConductor } from '@/lib/text'
import { createNotification } from '@/features/notifications/services/notification-service'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/features/notifications/types'
import { deriveWebpSibling } from '@/lib/images/derive-webp'
import { billGenerativeTurn } from '@/features/generative-media/billing'
import {
  GHOST_WRITE_SENDER_ID,
  GHOST_WRITE_SENDER_NAME,
  IMAGE_CONDUCTOR_SENDER_ID,
  IMAGE_CONDUCTOR_SENDER_NAME,
  VIDEO_CONDUCTOR_SENDER_ID,
  VIDEO_CONDUCTOR_SENDER_NAME,
  buildGenMediaChatKey,
  type GalleryItem,
  type GenerativeMediaScope,
} from '@/features/generative-media/types'
import { resolveCabinetRefToProviderUrl } from '@/features/generative-media/resolve-cabinet-ref'
import { startXaiVideoGeneration, getXaiVideoStatus } from '@/lib/video/providers/xai.provider'
import { getPollIntervalMs, getPollTimeoutMs } from '@/lib/video/video.config'
import { file } from '@/lib/file'
import {
  createGenerativeVideoJob,
  getGenerativeVideoJob,
  updateGenerativeVideoJob,
  type GenerativeVideoJob,
} from '@/features/generative-media/video-jobs'

const conversationService = new ConversationService()
const messageService = new MessageService()

export async function getOrCreateGenMediaConversation(params: {
  userId: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
}): Promise<Conversation> {
  const productId = buildGenMediaChatKey(params)
  const existing = await conversationService.findProductConversation(params.userId, productId)
  if (existing) return existing

  return conversationService.createConversation({
    type: 'product',
    participantIds: [params.userId],
    metadata: {
      productId,
      productName: 'Generative media editor',
      subject: productId,
      kind: 'generative_gallery',
      hiddenFromInbox: true,
    },
  })
}

export async function listGenMediaMessages(params: {
  userId: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  limit?: number
}): Promise<{ conversationId: string; messages: Message[] }> {
  const conversation = await getOrCreateGenMediaConversation(params)
  const messages = await messageService.getMessages(conversation.id, params.userId, {
    limit: params.limit ?? 50,
  })
  return { conversationId: conversation.id, messages }
}

/** Post upload as image message (no caption) so Generate history can reference it. */
export async function postUploadToGenMediaChat(params: {
  userId: string
  userName: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  url: string
  webpUrl?: string
  contentType?: string
  fileName?: string
}): Promise<{ success: boolean; conversationId?: string; messageId?: string; error?: string }> {
  const conversation = await getOrCreateGenMediaConversation(params)
  const message = await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: '',
      type: 'image',
      attachments: [
        {
          type: 'image',
          url: params.url,
          name: params.fileName || 'upload',
          size: 0,
          mimeType: params.contentType || 'image/jpeg',
        },
      ],
      metadata: {
        kind: 'gallery_upload',
        webpUrl: params.webpUrl,
      },
    },
    params.userId,
    params.userName || 'Member',
  )
  return { success: true, conversationId: conversation.id, messageId: message.id }
}

export async function runGhostWrite(params: {
  userId: string
  userName: string
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
}): Promise<{ success: boolean; enrichedPrompt?: string; conversationId?: string; error?: string }> {
  const draft = params.draft.trim()
  if (!draft) return { success: false, error: 'Enter a draft description or prompt first' }

  const conversation = await getOrCreateGenMediaConversation(params)
  const referenceId = `ghost:${conversation.id}:${Date.now()}`

  const bill = await billGenerativeTurn({
    userId: params.userId,
    action: 'ghost_write',
    conversationId: conversation.id,
    referenceId,
  })
  if (!bill.success) {
    return { success: false, error: bill.error, conversationId: conversation.id }
  }

  await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: draft,
      type: 'text',
      metadata: { kind: 'ghost_write_request' },
    },
    params.userId,
    params.userName || 'Member',
  )

  const ctxBits = [
    params.context?.name && `Name: ${params.context.name}`,
    params.context?.category && `Category: ${params.context.category}`,
    params.context?.description && `Details: ${params.context.description}`,
    params.context?.vendorName && `Vendor: ${params.context.vendorName}`,
    `Scope: ${params.scope}`,
  ]
    .filter(Boolean)
    .join('\n')

  const textResult = await TextConductor.generate({
    input: draft,
    instructions: [
      'You are Ghost-write for Ring Platform generative media.',
      'Enrich the user draft into a professional, user-friendly visual generation prompt.',
      'Search the web for similar products when helpful; compare and improve the prompt.',
      'Return ONLY the enriched prompt text (no preamble).',
      ctxBits && `Product context:\n${ctxBits}`,
    ]
      .filter(Boolean)
      .join('\n'),
    webSearch: true,
    maxTokens: 1200,
  })

  if (!textResult.success || !textResult.text?.trim()) {
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: textResult.error || 'Ghost-write failed',
        type: 'system',
      },
      GHOST_WRITE_SENDER_ID,
      GHOST_WRITE_SENDER_NAME,
    )
    return {
      success: false,
      error: textResult.error || 'Ghost-write failed',
      conversationId: conversation.id,
    }
  }

  const enriched = textResult.text.trim()
  await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: enriched,
      type: 'text',
      metadata: {
        kind: 'ghost_write_result',
        citations: textResult.citations,
        model: textResult.model,
      },
    },
    GHOST_WRITE_SENDER_ID,
    GHOST_WRITE_SENDER_NAME,
  )

  return { success: true, enrichedPrompt: enriched, conversationId: conversation.id }
}

export async function runGenMediaImageTurn(params: {
  userId: string
  userName: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  purpose?: string
  referenceImageUrls?: string[]
  notifyIfBackground?: boolean
  actionUrl?: string
}): Promise<{
  success: boolean
  conversationId?: string
  images?: Array<{ url: string; webpUrl?: string; recordId?: string }>
  galleryItems?: GalleryItem[]
  error?: string
}> {
  const prompt = params.prompt.trim()
  if (!prompt) return { success: false, error: 'Describe your media in full detail to generate' }
  if (prompt.length > 4000) return { success: false, error: 'Description is too long (max 4000 characters)' }

  const conversation = await getOrCreateGenMediaConversation(params)
  const referenceId = `img:${conversation.id}:${Date.now()}`

  const bill = await billGenerativeTurn({
    userId: params.userId,
    action: 'image_gen',
    conversationId: conversation.id,
    referenceId,
  })
  if (!bill.success) {
    return { success: false, error: bill.error, conversationId: conversation.id }
  }

  await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: prompt,
      type: 'text',
    },
    params.userId,
    params.userName || 'Member',
  )

  const purpose =
    params.purpose?.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) ||
    `genmedia-${params.fieldId}`.slice(0, 64)

  const rawRefs = (params.referenceImageUrls || []).filter(Boolean).slice(0, 3)
  const resolvedRefs: string[] = []
  for (const ref of rawRefs) {
    const resolved = await resolveCabinetRefToProviderUrl({
      userId: params.userId,
      ref,
      purpose: 'image',
    })
    if (!resolved.success || !resolved.dataUri) {
      return {
        success: false,
        conversationId: conversation.id,
        error: resolved.error || 'Failed to resolve reference image',
      }
    }
    resolvedRefs.push(resolved.dataUri)
  }

  const art = await ImageConductor.generate({
    purpose,
    prompt,
    actorId: params.userId,
    n: 4,
    aspectRatio: '1:1',
    ...(resolvedRefs.length ? { referenceImages: resolvedRefs.map((url) => ({ url })) } : {}),
  })

  if (!art.success || !art.images?.length) {
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: art.error || 'Preview generation failed',
        type: 'system',
      },
      IMAGE_CONDUCTOR_SENDER_ID,
      IMAGE_CONDUCTOR_SENDER_NAME,
    )
    return {
      success: false,
      conversationId: conversation.id,
      error: art.error || 'Preview generation failed',
    }
  }

  const images: Array<{ url: string; webpUrl?: string; recordId?: string }> = []
  for (const img of art.images) {
    const webp = await deriveWebpSibling({
      sourceUrl: img.url,
      contentType: img.contentType,
      purpose,
    })
    images.push({
      url: img.url,
      webpUrl: webp.webpUrl,
      recordId: img.recordId,
    })
  }

  await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: `Generated ${images.length} variations`,
      type: 'image',
      attachments: images.map((img, index) => ({
        type: 'image' as const,
        url: img.url,
        name: `variation-${index + 1}.png`,
        size: 0,
        mimeType: 'image/png',
      })),
    },
    IMAGE_CONDUCTOR_SENDER_ID,
    IMAGE_CONDUCTOR_SENDER_NAME,
  )

  if (params.notifyIfBackground) {
    try {
      await createNotification({
        userId: params.userId,
        type: NotificationType.SYSTEM_UPDATE,
        priority: NotificationPriority.NORMAL,
        title: 'Media ready',
        body: 'Your ImageConductor previews are ready to review.',
        actionText: 'Open editor',
        actionUrl: params.actionUrl || `/?field=${encodeURIComponent(params.fieldId)}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        data: {
          actionUrl: params.actionUrl,
          metadata: {
            conversationId: conversation.id,
            fieldId: params.fieldId,
            kind: 'image_gen_complete',
          },
        },
      })
    } catch (notifyError) {
      console.warn('Gen media notify failed', notifyError)
    }
  }

  const galleryItems: GalleryItem[] = images.map((img, index) => ({
    id: img.recordId || `gen_${Date.now()}_${index}`,
    originalUrl: img.url,
    webpUrl: img.webpUrl,
    contentType: 'image/png',
    source: 'generated',
    enabled: true,
    isPrimary: index === 0,
    createdAt: new Date().toISOString(),
  }))

  return {
    success: true,
    conversationId: conversation.id,
    images,
    galleryItems,
  }
}

export async function startGenMediaVideoJob(params: {
  userId: string
  userName: string
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
}): Promise<{
  success: boolean
  jobId?: string
  requestId?: string
  conversationId?: string
  pollIntervalMs?: number
  error?: string
}> {
  const prompt = params.prompt.trim()
  if (!prompt) return { success: false, error: 'Describe your media in full detail to generate' }
  if (prompt.length > 4000) return { success: false, error: 'Description is too long (max 4000 characters)' }

  const rawImage =
    params.imageUrl?.trim() || (params.referenceImageUrls || []).filter(Boolean)[0]?.trim()
  if (!rawImage) {
    return { success: false, error: 'A reference image is required for video generation' }
  }

  const conversation = await getOrCreateGenMediaConversation(params)
  const referenceId = `vid:${conversation.id}:${Date.now()}`

  const bill = await billGenerativeTurn({
    userId: params.userId,
    action: 'video_gen',
    conversationId: conversation.id,
    referenceId,
  })
  if (!bill.success) {
    return { success: false, error: bill.error, conversationId: conversation.id }
  }

  await messageService.sendMessage(
    {
      conversationId: conversation.id,
      content: prompt,
      type: 'text',
      metadata: { kind: 'video_gen_request' },
    },
    params.userId,
    params.userName || 'Member',
  )

  const resolved = await resolveCabinetRefToProviderUrl({
    userId: params.userId,
    ref: rawImage,
    purpose: 'video',
  })
  if (!resolved.success || !resolved.httpsUrl) {
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: resolved.error || 'Failed to resolve reference image for video',
        type: 'system',
      },
      VIDEO_CONDUCTOR_SENDER_ID,
      VIDEO_CONDUCTOR_SENDER_NAME,
    )
    return {
      success: false,
      conversationId: conversation.id,
      error: resolved.error || 'Failed to resolve reference image for video',
    }
  }

  const purpose =
    params.purpose?.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) ||
    `genmedia-video-${params.fieldId}`.slice(0, 64)

  let requestId: string
  try {
    requestId = await startXaiVideoGeneration({
      prompt,
      imageUrl: resolved.httpsUrl,
      qualityMode: 'draft_i2v',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video start failed'
    await messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: message,
        type: 'system',
      },
      VIDEO_CONDUCTOR_SENDER_ID,
      VIDEO_CONDUCTOR_SENDER_NAME,
    )
    return { success: false, conversationId: conversation.id, error: message }
  }

  const { id: jobId } = await createGenerativeVideoJob({
    userId: params.userId,
    requestId,
    conversationId: conversation.id,
    scope: params.scope,
    pageSlug: params.pageSlug,
    fieldId: params.fieldId,
    entityId: params.entityId,
    prompt,
    imageUrl: resolved.httpsUrl,
    purpose,
    notifyIfBackground: params.notifyIfBackground,
    actionUrl: params.actionUrl,
    referenceId,
  })

  return {
    success: true,
    jobId,
    requestId,
    conversationId: conversation.id,
    pollIntervalMs: getPollIntervalMs(),
  }
}

async function finalizeGenMediaVideoJob(params: {
  jobId: string
  job: GenerativeVideoJob
  temporaryUrl: string
  duration?: number
  model?: string
  requestId: string
}): Promise<{
  success: boolean
  video?: { url: string; fileId?: string; recordId?: string }
  galleryItems?: GalleryItem[]
  error?: string
}> {
  // Persist via VideoConductor.generate path is blocking; upload directly here.
  const response = await fetch(params.temporaryUrl)
  if (!response.ok) {
    await updateGenerativeVideoJob(params.jobId, {
      status: 'failed',
      error: `Failed to download generated video (${response.status})`,
    })
    return { success: false, error: `Failed to download generated video (${response.status})` }
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const objectKey = `generated/videos/${params.job.purpose}/draft_i2v/${Date.now()}-${params.jobId.slice(0, 8)}.mp4`
  const upload = await file().upload(objectKey, buffer, {
    access: 'public',
    contentType: 'video/mp4',
    metadata: {
      source: 'xai',
      model: params.model || 'grok-imagine-video-1.5',
      qualityMode: 'draft_i2v',
      requestId: params.requestId,
      purpose: params.job.purpose,
    },
  })

  if (!upload.success || !upload.url) {
    const err = upload.error || 'Failed to upload generated video'
    await updateGenerativeVideoJob(params.jobId, { status: 'failed', error: err })
    return { success: false, error: err }
  }

  await messageService.sendMessage(
    {
      conversationId: params.job.conversationId,
      content: 'Generated video',
      type: 'file',
      attachments: [
        {
          type: 'file',
          url: upload.url,
          name: 'generated.mp4',
          size: upload.size || buffer.length,
          mimeType: 'video/mp4',
        },
      ],
      metadata: {
        kind: 'video_gen_result',
        fileId: upload.fileId,
        requestId: params.requestId,
      },
    },
    VIDEO_CONDUCTOR_SENDER_ID,
    VIDEO_CONDUCTOR_SENDER_NAME,
  )

  if (params.job.notifyIfBackground) {
    try {
      await createNotification({
        userId: params.job.userId,
        type: NotificationType.SYSTEM_UPDATE,
        priority: NotificationPriority.NORMAL,
        title: 'Video ready',
        body: 'Your VideoConductor clip is ready to review.',
        actionText: 'Open editor',
        actionUrl: params.job.actionUrl || `/?field=${encodeURIComponent(params.job.fieldId)}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        data: {
          actionUrl: params.job.actionUrl,
          metadata: {
            conversationId: params.job.conversationId,
            fieldId: params.job.fieldId,
            kind: 'video_gen_complete',
          },
        },
      })
    } catch (notifyError) {
      console.warn('Gen media video notify failed', notifyError)
    }
  }

  await updateGenerativeVideoJob(params.jobId, {
    status: 'done',
    progress: 100,
    resultUrl: upload.url,
    resultFileId: upload.fileId,
    finalizedAt: new Date().toISOString(),
  })

  const galleryItems: GalleryItem[] = [
    {
      id: `vid_${params.jobId}`,
      originalUrl: upload.url,
      contentType: 'video/mp4',
      source: 'video',
      enabled: true,
      isPrimary: true,
      fileId: upload.fileId,
      createdAt: new Date().toISOString(),
    },
  ]

  return {
    success: true,
    video: { url: upload.url, fileId: upload.fileId, recordId: `vid_${params.jobId}` },
    galleryItems,
  }
}

export async function pollGenMediaVideoJob(params: {
  userId: string
  jobId: string
}): Promise<{
  success: boolean
  status?: GenerativeVideoJob['status'] | string
  progress?: number | null
  elapsedMs?: number
  conversationId?: string
  video?: { url: string; fileId?: string; recordId?: string }
  galleryItems?: GalleryItem[]
  error?: string
}> {
  const jobRow = await getGenerativeVideoJob(params.jobId)
  if (!jobRow) return { success: false, error: 'Job not found' }
  if (jobRow.userId !== params.userId) return { success: false, error: 'Forbidden' }

  const startedAt = Date.parse(jobRow.createdAt) || Date.now()
  const elapsedMs = Date.now() - startedAt

  if (jobRow.status === 'cancelled') {
    return {
      success: true,
      status: 'cancelled',
      progress: jobRow.progress ?? null,
      elapsedMs,
      conversationId: jobRow.conversationId,
    }
  }

  if (jobRow.status === 'done' && jobRow.resultUrl) {
    return {
      success: true,
      status: 'done',
      progress: 100,
      elapsedMs,
      conversationId: jobRow.conversationId,
      video: {
        url: jobRow.resultUrl,
        fileId: jobRow.resultFileId,
        recordId: jobRow.resultRecordId || `vid_${params.jobId}`,
      },
      galleryItems: [
        {
          id: jobRow.resultRecordId || `vid_${params.jobId}`,
          originalUrl: jobRow.resultUrl,
          contentType: 'video/mp4',
          source: 'video',
          enabled: true,
          isPrimary: true,
          fileId: jobRow.resultFileId,
          createdAt: jobRow.finalizedAt || jobRow.updatedAt,
        },
      ],
    }
  }

  if (jobRow.status === 'failed' || jobRow.status === 'expired') {
    return {
      success: false,
      status: jobRow.status,
      progress: jobRow.progress ?? null,
      elapsedMs,
      conversationId: jobRow.conversationId,
      error: jobRow.error || `Video ${jobRow.status}`,
    }
  }

  let statusPayload
  try {
    statusPayload = await getXaiVideoStatus(jobRow.requestId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Poll failed'
    return { success: false, error: message, conversationId: jobRow.conversationId, elapsedMs }
  }

  // Re-check cancel — late done must no-op
  const fresh = await getGenerativeVideoJob(params.jobId)
  if (fresh?.status === 'cancelled') {
    return {
      success: true,
      status: 'cancelled',
      progress: statusPayload.progress ?? fresh.progress ?? null,
      elapsedMs,
      conversationId: jobRow.conversationId,
    }
  }

  const progress =
    typeof statusPayload.progress === 'number' ? statusPayload.progress : jobRow.progress ?? null

  if (statusPayload.status === 'failed' || statusPayload.status === 'expired') {
    const err = `Video ${statusPayload.status}: ${JSON.stringify(statusPayload.error || {})}`
    await updateGenerativeVideoJob(params.jobId, {
      status: statusPayload.status as GenerativeVideoJob['status'],
      progress,
      error: err,
    })
    await messageService.sendMessage(
      {
        conversationId: jobRow.conversationId,
        content: err,
        type: 'system',
      },
      VIDEO_CONDUCTOR_SENDER_ID,
      VIDEO_CONDUCTOR_SENDER_NAME,
    )
    return {
      success: false,
      status: statusPayload.status,
      progress,
      elapsedMs,
      conversationId: jobRow.conversationId,
      error: err,
    }
  }

  if (statusPayload.status === 'done') {
    const temporaryUrl = statusPayload.video?.url
    if (!temporaryUrl) {
      await updateGenerativeVideoJob(params.jobId, {
        status: 'failed',
        error: 'xAI returned no video URL',
      })
      return {
        success: false,
        status: 'failed',
        progress: 100,
        elapsedMs,
        conversationId: jobRow.conversationId,
        error: 'xAI returned no video URL',
      }
    }
    if (statusPayload.video?.respect_moderation === false) {
      await updateGenerativeVideoJob(params.jobId, {
        status: 'failed',
        error: 'Video filtered by moderation',
        progress: 100,
      })
      return {
        success: false,
        status: 'failed',
        progress: 100,
        elapsedMs,
        conversationId: jobRow.conversationId,
        error: 'Video filtered by moderation',
      }
    }

    const finalized = await finalizeGenMediaVideoJob({
      jobId: params.jobId,
      job: jobRow,
      temporaryUrl,
      duration: statusPayload.video?.duration,
      model: statusPayload.model,
      requestId: jobRow.requestId,
    })
    return {
      ...finalized,
      status: finalized.success ? 'done' : 'failed',
      progress: 100,
      elapsedMs,
      conversationId: jobRow.conversationId,
    }
  }

  await updateGenerativeVideoJob(params.jobId, { progress, status: 'pending' })
  return {
    success: true,
    status: statusPayload.status || 'pending',
    progress,
    elapsedMs,
    conversationId: jobRow.conversationId,
  }
}

export async function cancelGenMediaVideoJob(params: {
  userId: string
  jobId: string
}): Promise<{ success: boolean; error?: string }> {
  const jobRow = await getGenerativeVideoJob(params.jobId)
  if (!jobRow) return { success: false, error: 'Job not found' }
  if (jobRow.userId !== params.userId) return { success: false, error: 'Forbidden' }
  if (jobRow.status === 'done' || jobRow.status === 'cancelled') {
    return { success: true }
  }
  await updateGenerativeVideoJob(params.jobId, { status: 'cancelled' })
  return { success: true }
}

export async function runGenMediaVideoTurn(params: {
  userId: string
  userName: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  purpose?: string
  /** HTTPS, data URI, cabinet download path, or nodeId — resolved to HTTPS for xAI */
  imageUrl?: string
  referenceImageUrls?: string[]
  notifyIfBackground?: boolean
  actionUrl?: string
}): Promise<{
  success: boolean
  conversationId?: string
  video?: { url: string; fileId?: string; recordId?: string }
  galleryItems?: GalleryItem[]
  error?: string
}> {
  const started = await startGenMediaVideoJob(params)
  if (!started.success || !started.jobId) {
    return {
      success: false,
      conversationId: started.conversationId,
      error: started.error || 'Failed to start video job',
    }
  }

  const timeoutMs = getPollTimeoutMs()
  const intervalMs = started.pollIntervalMs || getPollIntervalMs()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const polled = await pollGenMediaVideoJob({
      userId: params.userId,
      jobId: started.jobId,
    })
    if (polled.status === 'cancelled') {
      return {
        success: false,
        conversationId: polled.conversationId || started.conversationId,
        error: 'Video generation cancelled',
      }
    }
    if (polled.status === 'done' && polled.video?.url) {
      return {
        success: true,
        conversationId: polled.conversationId || started.conversationId,
        video: polled.video,
        galleryItems: polled.galleryItems,
      }
    }
    if (polled.status === 'failed' || polled.status === 'expired' || polled.success === false) {
      return {
        success: false,
        conversationId: polled.conversationId || started.conversationId,
        error: polled.error || 'Video generation failed',
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return {
    success: false,
    conversationId: started.conversationId,
    error: `Timeout waiting for video ${started.requestId}`,
  }
}
