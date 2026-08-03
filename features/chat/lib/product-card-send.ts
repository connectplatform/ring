import 'server-only'

import type { Message, ProductCardMetadata } from '@/features/chat/types'
import { MessageService } from '@/features/chat/services/message-service'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { parseProductCardMarkers } from '@/features/chat/lib/product-card-marker'
import {
  buildProductCardMetadata,
  loadProductForCard,
} from '@/features/chat/lib/product-card-hydrate'

export type SendProductCardsFromTextResult = {
  textMessage: Message | null
  productCardMessages: Message[]
  unresolved: string[]
}

/**
 * Server-side marker expansion used by /messages API and product agent.
 * Always CRM-hydrates; never trusts marker text for price.
 */
export async function sendProductCardsFromText(input: {
  conversationId: string
  text: string
  locale?: Locale
  senderId: string
  senderName: string
  senderAvatar?: string
  /** When true and no markers, send plain text only (caller may skip calling). */
  sendTextIfEmptyMarkers?: boolean
}): Promise<SendProductCardsFromTextResult> {
  const locale = input.locale ?? defaultLocale
  const messageService = new MessageService()
  const { cleanedText, refs } = parseProductCardMarkers(input.text)

  const pendingCards: ProductCardMetadata[] = []
  const unresolved: string[] = []
  let textOut = cleanedText

  for (const ref of refs) {
    if (!ref.productId) {
      unresolved.push(ref.raw)
      if (!textOut.includes(ref.raw)) {
        textOut = textOut ? `${textOut}\n${ref.raw}` : ref.raw
      }
      continue
    }
    const product = await loadProductForCard(ref.productId)
    if (!product) {
      unresolved.push(ref.raw)
      if (!textOut.includes(ref.raw)) {
        textOut = textOut ? `${textOut}\n${ref.raw}` : ref.raw
      }
      continue
    }
    pendingCards.push(buildProductCardMetadata(product, locale))
  }

  let textMessage: Message | null = null
  if (textOut.trim()) {
    textMessage = await messageService.sendMessage(
      {
        conversationId: input.conversationId,
        content: textOut.trim(),
        type: 'text',
      },
      input.senderId,
      input.senderName,
      input.senderAvatar,
    )
  }

  const productCardMessages: Message[] = []
  for (const metadata of pendingCards) {
    const card = await messageService.sendMessage(
      {
        conversationId: input.conversationId,
        content: `Product: ${metadata.title}`,
        type: 'product_card',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      input.senderId,
      input.senderName,
      input.senderAvatar,
    )
    productCardMessages.push(card)
  }

  return { textMessage, productCardMessages, unresolved }
}

export async function sendSingleProductCard(input: {
  conversationId: string
  productId: string
  locale?: Locale
  senderId: string
  senderName: string
  senderAvatar?: string
  content?: string
}): Promise<Message | null> {
  const product = await loadProductForCard(input.productId)
  if (!product) return null
  const locale = input.locale ?? defaultLocale
  const metadata = buildProductCardMetadata(product, locale)
  const messageService = new MessageService()
  return messageService.sendMessage(
    {
      conversationId: input.conversationId,
      content: input.content?.trim() || `Product: ${metadata.title}`,
      type: 'product_card',
      metadata: metadata as unknown as Record<string, unknown>,
    },
    input.senderId,
    input.senderName,
    input.senderAvatar,
  )
}
