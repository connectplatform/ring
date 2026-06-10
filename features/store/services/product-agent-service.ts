import {
  createLLMClient,
  createStreamingLLMClient,
  normalizeStreamMessages,
  type LLMStreamMessage,
} from '@/lib/ai/llm-client'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Conversation, Message } from '@/features/chat/types'
import type { StoreProduct } from '@/features/store/types'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import {
  getProductAgentFallbackReply,
  getProductAgentSenderName,
  getProductAgentWelcome,
} from '@/lib/i18n/store-labels'
import type { Locale } from '@/lib/locale-config'

export const STORE_AGENT_SENDER_ID = 'ring-store-agent'
export const STORE_AGENT_SENDER_NAME = 'AI Sales Assistant'

export function buildAgentSystemPrompt(product: StoreProduct): string {
  return `You are a helpful, concise Ring Store sales assistant for one product.

Product:
- Name: ${product.name}
- Price: ${product.price} ${product.currency}
- Category: ${product.category || 'General'}
- In stock: ${product.inStock ? 'yes' : 'no'}
- Description: ${product.description || 'No description provided.'}
${product.vendorName ? `- Vendor: ${product.vendorName}` : ''}

Rules:
- Answer only about this product, shipping basics, variants, and purchase guidance.
- Be friendly and factual. If unsure, say so and suggest checking product details or contacting the vendor.
- Keep replies under 120 words unless the customer asks for detail.
- Do not invent discounts, inventory counts, or policies.`
}

export function historyToStreamMessages(history: Message[]): LLMStreamMessage[] {
  const mapped = history
    .slice(-12)
    .map((message) => ({
      role:
        message.senderId === STORE_AGENT_SENDER_ID || message.senderId === 'system'
          ? ('assistant' as const)
          : ('user' as const),
      content: message.content,
    }))
    .filter((message) => message.content.trim())

  return normalizeStreamMessages(mapped)
}

/** @deprecated Single-turn prompt kept for non-streaming fallback */
function buildAgentPrompt(product: StoreProduct, history: Message[], latestUserMessage: string): string {
  const transcript = history
    .slice(-12)
    .map((message) => {
      const role =
        message.senderId === STORE_AGENT_SENDER_ID || message.senderId === 'system'
          ? 'Assistant'
          : 'Customer'
      return `${role}: ${message.content}`
    })
    .join('\n')

  return `${buildAgentSystemPrompt(product)}

Conversation so far:
${transcript || '(no prior messages)'}

Customer: ${latestUserMessage}
Assistant:`
}

export type ProductAgentStreamContext = {
  conversation: Conversation
  userMessage: Message
  product: StoreProduct
  streamMessages: LLMStreamMessage[]
  systemPrompt: string
  senderName: string
  fallbackReply: string
}

export class ProductAgentService {
  private conversationService = new ConversationService()
  private messageService = new MessageService()
  private storeAdapter = new PostgreSQLStoreAdapter()

  async loadProduct(productId: string): Promise<StoreProduct | null> {
    return this.storeAdapter.getProductById(productId)
  }

  async getOrCreateConversation(
    userId: string,
    product: StoreProduct,
    locale: Locale,
  ): Promise<Conversation> {
    const existing = await this.conversationService.findProductConversation(userId, product.id)
    if (existing) {
      return existing
    }

    const subject = product.name
    const conversation = await this.conversationService.createConversation({
      type: 'product',
      participantIds: [userId],
      metadata: {
        productId: product.id,
        productName: product.name,
        subject,
        vendorId: product.productOwner,
      },
    })

    const welcome = await getProductAgentWelcome(locale, product.name)
    const senderName = await getProductAgentSenderName(locale)

    await this.messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: welcome,
        type: 'text',
      },
      STORE_AGENT_SENDER_ID,
      senderName,
    )

    return conversation
  }

  async beginSendMessage(
    userId: string,
    userName: string,
    productId: string,
    content: string,
    locale: Locale,
  ): Promise<ProductAgentStreamContext> {
    const trimmed = content.trim()
    if (!trimmed) {
      throw new Error('Message content is required')
    }

    const product = await this.loadProduct(productId)
    if (!product) {
      throw new Error('Product not found')
    }

    const conversation = await this.getOrCreateConversation(userId, product, locale)

    const userMessage = await this.messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: trimmed,
        type: 'text',
      },
      userId,
      userName,
    )

    const history = await this.messageService.getMessages(conversation.id, userId, { limit: 20 })
    const senderName = await getProductAgentSenderName(locale)
    const fallbackReply = await getProductAgentFallbackReply(locale)

    return {
      conversation,
      userMessage,
      product,
      streamMessages: historyToStreamMessages(history),
      systemPrompt: buildAgentSystemPrompt(product),
      senderName,
      fallbackReply,
    }
  }

  async completeAgentMessage(
    conversationId: string,
    content: string,
    locale: Locale,
  ): Promise<Message> {
    const senderName = await getProductAgentSenderName(locale)
    const fallbackReply = await getProductAgentFallbackReply(locale)

    return this.messageService.sendMessage(
      {
        conversationId,
        content: content.trim() || fallbackReply,
        type: 'text',
      },
      STORE_AGENT_SENDER_ID,
      senderName,
    )
  }

  createStreamingClient() {
    return createStreamingLLMClient(true)
  }

  async sendMessage(
    userId: string,
    userName: string,
    productId: string,
    content: string,
    locale: Locale,
  ): Promise<{ conversation: Conversation; userMessage: Message; agentMessage: Message }> {
    const context = await this.beginSendMessage(userId, userName, productId, content, locale)
    const llm = this.createStreamingClient()
    const prompt = buildAgentPrompt(context.product, await this.messageService.getMessages(context.conversation.id, userId, { limit: 20 }), content)
    const llmResponse = await llm.complete(prompt, { maxTokens: 600, temperature: 0.35 })

    const agentMessage = await this.completeAgentMessage(
      context.conversation.id,
      llmResponse.content,
      locale,
    )

    return {
      conversation: context.conversation,
      userMessage: context.userMessage,
      agentMessage,
    }
  }
}
