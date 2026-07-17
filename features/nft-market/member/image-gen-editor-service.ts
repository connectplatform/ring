/**
 * @deprecated Prefer `@/features/generative-media/service`.
 * Thin compatibility adapters for legacy NFT image-gen call sites.
 */
import 'server-only'

import {
  getOrCreateGenMediaConversation,
  listGenMediaMessages,
  runGenMediaImageTurn,
} from '@/features/generative-media/service'

export async function getOrCreateImageGenConversation(params: {
  userId: string
  pageSlug: string
  fieldId: string
}) {
  return getOrCreateGenMediaConversation({
    userId: params.userId,
    scope: 'nft',
    pageSlug: params.pageSlug,
    fieldId: params.fieldId,
  })
}

export async function listImageGenMessages(params: {
  userId: string
  pageSlug: string
  fieldId: string
  limit?: number
}) {
  return listGenMediaMessages({
    userId: params.userId,
    scope: 'nft',
    pageSlug: params.pageSlug,
    fieldId: params.fieldId,
    limit: params.limit,
  })
}

export async function runImageGenEditorTurn(params: {
  userId: string
  userName: string
  pageSlug: string
  fieldId: string
  prompt: string
  purpose?: string
  notifyIfBackground?: boolean
  actionUrl?: string
  referenceImageUrls?: string[]
}) {
  return runGenMediaImageTurn({
    ...params,
    scope: 'nft',
  })
}
