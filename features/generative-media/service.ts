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
  buildGenMediaChatKey,
  type GalleryItem,
  type GenerativeMediaScope,
} from '@/features/generative-media/types'

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

  const refs = (params.referenceImageUrls || []).filter(Boolean).slice(0, 3)
  const art = await ImageConductor.generate({
    purpose,
    prompt,
    actorId: params.userId,
    n: 4,
    aspectRatio: '1:1',
    ...(refs.length ? { referenceImages: refs.map((url) => ({ url })) } : {}),
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
