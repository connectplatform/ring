/**
 * Product commerce tools — session-bound; model never supplies uid.
 * Guests rejected. checkout.redirect does NOT createOrder (needs shipping info).
 */

import 'server-only'

import {
  addToServerCart,
  getServerCart,
  summarizeServerCart,
} from '@/features/store/services/server-cart'
import { syncCartSoftHolds } from '@/features/store/services/inventory-sync'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export const PRODUCT_COMMERCE_TOOL_NAMES = [
  'cart_add',
  'cart_summary',
  'checkout_redirect',
] as const

export type ProductCommerceToolName = (typeof PRODUCT_COMMERCE_TOOL_NAMES)[number]

/** Anthropic tool schemas — no uid fields. */
export const PRODUCT_COMMERCE_TOOLS: Tool[] = [
  {
    name: 'cart_add',
    description:
      'Add the current product (or a qty of it) to the shopper cart. Server binds the logged-in user; never invent a user id.',
    input_schema: {
      type: 'object',
      properties: {
        quantity: {
          type: 'number',
          description: 'Quantity to add (default 1)',
        },
      },
    },
  },
  {
    name: 'cart_summary',
    description: 'Show items currently in the shopper cart with names, quantities, and prices.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'checkout_redirect',
    description:
      'Send the shopper to the checkout page to enter shipping and pay. Does not create an order in chat.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
]

const UID_KEYS = ['userId', 'uid', 'asUserId', 'user_id', 'buyerId', 'customerId'] as const

export function stripModelUidArgs(args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args }
  for (const key of UID_KEYS) {
    if (key in next) {
      console.warn('[ProductCommerceToolRunner] stripped model-supplied identity field:', key)
      delete next[key]
    }
  }
  return next
}

export type ProductCommerceToolResult = {
  ok: boolean
  tool: ProductCommerceToolName | string
  error?: string
  data?: Record<string, unknown>
  /** Client should navigate here (checkout.redirect) */
  redirectTo?: string
  /** Client should refresh cart from server */
  cartUpdated?: boolean
}

async function syncHoldsForUser(userId: string): Promise<void> {
  const cart = await getServerCart(userId)
  const adapter = new PostgreSQLStoreAdapter()
  const holdItems = []
  for (const line of cart.items) {
    const product = await adapter.getProductById(line.productId)
    holdItems.push({
      productId: line.productId,
      quantity: line.qty,
      digitalProduct: product?.digitalProduct,
      instantDelivery: product?.instantDelivery,
    })
  }
  await syncCartSoftHolds(userId, holdItems)
}

/**
 * Run one commerce tool. sessionUserId is the ONLY identity source.
 */
export async function runProductCommerceTool(input: {
  sessionUserId: string
  productId: string
  tool: string
  args?: Record<string, unknown>
  locale?: string
}): Promise<ProductCommerceToolResult> {
  const sessionUserId = String(input.sessionUserId || '').trim()
  if (!sessionUserId) {
    return { ok: false, tool: input.tool, error: 'Unauthorized: no session user' }
  }

  const args = stripModelUidArgs(input.args || {})
  const tool = String(input.tool || '').trim()

  try {
    if (tool === 'cart_add') {
      const qty = Math.max(1, Math.floor(Number(args.quantity ?? 1) || 1))
      const productId = String(input.productId || '').trim()
      if (!productId) {
        return { ok: false, tool, error: 'productId required' }
      }
      const adapter = new PostgreSQLStoreAdapter()
      const product = await adapter.getProductById(productId)
      if (!product) {
        return { ok: false, tool, error: 'Product not found' }
      }
      const cart = await addToServerCart(sessionUserId, productId, qty)
      return {
        ok: true,
        tool,
        cartUpdated: true,
        data: {
          productId,
          name: product.name,
          qtyAdded: qty,
          cartItems: cart.items,
        },
      }
    }

    if (tool === 'cart_summary') {
      const summary = await summarizeServerCart(sessionUserId)
      return {
        ok: true,
        tool,
        data: summary as unknown as Record<string, unknown>,
      }
    }

    if (tool === 'checkout_redirect') {
      await syncHoldsForUser(sessionUserId)
      const summary = await summarizeServerCart(sessionUserId)
      if (summary.empty) {
        return { ok: false, tool, error: 'Cart is empty' }
      }
      const locale = (input.locale || 'en') as Locale
      return {
        ok: true,
        tool,
        redirectTo: ROUTES.CHECKOUT(locale),
        data: {
          message: 'Redirect shopper to checkout to enter shipping and pay.',
          totalItems: summary.totalItems,
        },
      }
    }

    return { ok: false, tool, error: `Unknown tool: ${tool}` }
  } catch (error) {
    return {
      ok: false,
      tool,
      error: error instanceof Error ? error.message : 'Tool failed',
    }
  }
}

/** Build handlers closed over sessionUserId — safe for Anthropic tool_use loop. */
export function buildProductCommerceToolHandlers(ctx: {
  sessionUserId: string
  productId: string
  locale: string
}): Map<string, (input: Record<string, unknown>) => Promise<unknown>> {
  const map = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>()
  for (const name of PRODUCT_COMMERCE_TOOL_NAMES) {
    map.set(name, async (rawArgs) =>
      runProductCommerceTool({
        sessionUserId: ctx.sessionUserId,
        productId: ctx.productId,
        tool: name,
        args: rawArgs,
        locale: ctx.locale,
      }),
    )
  }
  return map
}
