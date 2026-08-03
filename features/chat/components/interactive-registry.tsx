'use client'

import type { ReactNode } from 'react'
import type { Message } from '@/features/chat/types'
import {
  resolveInteractiveKind,
  type InteractiveMessageType,
} from '@/features/chat/lib/interactive-kind'
import PaymentRequestMessageWidget from '@/features/wallet/components/payment-request-message-widget'
import { EnvRequestMessageWidget } from '@/features/crm/lab/env-request-message-widget'
import { TaskMessageWidget } from '@/features/tasks/components/task-message-widget'
import { PollMessageWidget } from '@/features/chat/interactive/poll-message-widget'
import { RsvpMessageWidget } from '@/features/chat/interactive/rsvp-message-widget'
import { ShareCardMessageWidget } from '@/features/chat/interactive/share-card-message-widget'
import { DaoJarMessageWidget } from '@/features/public-pools/components/dao-jar-message-widget'
import { GameRequestMessageWidget } from '@/features/chat/interactive/game-request-message-widget'
import { CartSummaryMessageWidget } from '@/features/chat/interactive/cart-summary-message-widget'
import { ProductCardMessageWidget } from '@/features/chat/interactive/product-card-message-widget'

export interface InteractiveWidgetProps {
  message: Message
  isOwn: boolean
  currentUserId?: string
}

type WidgetRenderer = (props: InteractiveWidgetProps) => ReactNode

const REGISTRY: Record<InteractiveMessageType, WidgetRenderer> = {
  payment_request: ({ message, isOwn }) => (
    <PaymentRequestMessageWidget message={message} isOwn={isOwn} />
  ),
  env_request: ({ message, isOwn }) => (
    <EnvRequestMessageWidget message={message} isOwn={isOwn} />
  ),
  task: ({ message, isOwn, currentUserId }) => (
    <TaskMessageWidget message={message} isOwn={isOwn} currentUserId={currentUserId} />
  ),
  poll: ({ message, isOwn, currentUserId }) => (
    <PollMessageWidget message={message} isOwn={isOwn} currentUserId={currentUserId} />
  ),
  rsvp: ({ message, isOwn, currentUserId }) => (
    <RsvpMessageWidget message={message} isOwn={isOwn} currentUserId={currentUserId} />
  ),
  dao_jar: ({ message, isOwn }) => (
    <DaoJarMessageWidget message={message} isOwn={isOwn} />
  ),
  share_card: ({ message, isOwn }) => (
    <ShareCardMessageWidget message={message} isOwn={isOwn} />
  ),
  game_request: ({ message, isOwn, currentUserId }) => (
    <GameRequestMessageWidget message={message} isOwn={isOwn} currentUserId={currentUserId} />
  ),
  cart_summary: ({ message, isOwn }) => (
    <CartSummaryMessageWidget message={message} isOwn={isOwn} />
  ),
  product_card: ({ message, isOwn }) => (
    <ProductCardMessageWidget message={message} isOwn={isOwn} />
  ),
}

/** Renders the interactive widget for a message, or null if not interactive. */
export function renderInteractiveWidget(props: InteractiveWidgetProps): ReactNode {
  const kind = resolveInteractiveKind(props.message)
  if (!kind) return null
  return REGISTRY[kind](props)
}

/** True when bubble should skip plain text body (widget owns the content). */
export function hidesInteractiveTextBody(message: Message): boolean {
  return resolveInteractiveKind(message) != null
}
