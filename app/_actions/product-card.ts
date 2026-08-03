'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import type { Message } from '@/features/chat/types'
import { defaultLocale, type Locale } from '@/i18n/shared'
import {
  resolveProductIdFromRef,
  textHasProductCardMarkers,
} from '@/features/chat/lib/product-card-marker'
import {
  sendProductCardsFromText,
  sendSingleProductCard,
} from '@/features/chat/lib/product-card-send'

export type ProductCardActionResult = {
  success: boolean
  error?: string
  message?: Message
  messages?: Message[]
  unresolved?: string[]
}

/**
 * Create a single CRM-hydrated product_card in a conversation.
 * Price/title always from store_products — never from client payload.
 */
export async function createProductCardMessage(input: {
  conversationId: string
  productIdOrUrl: string
  content?: string
  locale?: Locale
}): Promise<ProductCardActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const conversationId = String(input.conversationId || '').trim()
    if (!conversationId) return { success: false, error: 'conversationId required' }

    const productId = resolveProductIdFromRef(input.productIdOrUrl)
    if (!productId) return { success: false, error: 'Invalid product reference' }

    const message = await sendSingleProductCard({
      conversationId,
      productId,
      locale: input.locale ?? defaultLocale,
      senderId: session.user.id,
      senderName: session.user.name || session.user.email || 'User',
      senderAvatar: session.user.image || undefined,
      content: input.content,
    })

    if (!message) return { success: false, error: 'Product not found' }

    revalidatePath('/[locale]/messages')
    return { success: true, message }
  } catch (err) {
    console.error('createProductCardMessage failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create product card',
    }
  }
}

/**
 * Expand `[product=…]` markers for the authenticated user.
 */
export async function resolveAndCreateProductCardsFromText(input: {
  conversationId: string
  text: string
  locale?: Locale
}): Promise<ProductCardActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const conversationId = String(input.conversationId || '').trim()
    if (!conversationId) return { success: false, error: 'conversationId required' }
    if (!textHasProductCardMarkers(input.text)) {
      return { success: false, error: 'No product markers' }
    }

    const result = await sendProductCardsFromText({
      conversationId,
      text: input.text,
      locale: input.locale ?? defaultLocale,
      senderId: session.user.id,
      senderName: session.user.name || session.user.email || 'User',
      senderAvatar: session.user.image || undefined,
    })

    const messages = [
      ...(result.textMessage ? [result.textMessage] : []),
      ...result.productCardMessages,
    ]

    if (messages.length === 0) {
      return {
        success: false,
        error: 'Could not resolve any product cards',
        unresolved: result.unresolved,
      }
    }

    revalidatePath('/[locale]/messages')
    return {
      success: true,
      messages,
      message: messages[messages.length - 1],
      unresolved: result.unresolved.length ? result.unresolved : undefined,
    }
  } catch (err) {
    console.error('resolveAndCreateProductCardsFromText failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to expand product markers',
    }
  }
}

export { textHasProductCardMarkers }
