import { createLLMClient } from '@/lib/ai/llm-client'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Conversation, Message } from '@/features/chat/types'
import type { StoreProduct } from '@/features/store/types'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'

export const STORE_AGENT_SENDER_ID = 'ring-store-agent'
export const STORE_AGENT_SENDER_NAME = 'AI Sales Assistant'

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
- Do not invent discounts, inventory counts, or policies.

Conversation so far:
${transcript || '(no prior messages)'}

Customer: ${latestUserMessage}
Assistant:`
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

    await this.messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: `Hi! I can help with questions about ${product.name}. Ask about features, sizing, shipping, or how to order.`,
        type: 'text',
      },
      STORE_AGENT_SENDER_ID,
      STORE_AGENT_SENDER_NAME,
    )

    return conversation
  }

  async sendMessage(
    userId: string,
    userName: string,
    productId: string,
    content: string,
  ): Promise<{ conversation: Conversation; userMessage: Message; agentMessage: Message }> {
    const trimmed = content.trim()
    if (!trimmed) {
      throw new Error('Message content is required')
    }

    const product = await this.loadProduct(productId)
    if (!product) {
      throw new Error('Product not found')
    }

    const conversation = await this.getOrCreateConversation(userId, product)

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
    const llm = createLLMClient(true)
    const prompt = buildAgentPrompt(product, history, trimmed)
    const llmResponse = await llm.complete(prompt, { maxTokens: 600, temperature: 0.35 })

    const agentMessage = await this.messageService.sendMessage(
      {
        conversationId: conversation.id,
        content: llmResponse.content.trim() || 'I am here to help with this product. Could you rephrase your question?',
        type: 'text',
      },
      STORE_AGENT_SENDER_ID,
      STORE_AGENT_SENDER_NAME,
    )

    return { conversation, userMessage, agentMessage }
  }
}
