/**
 * Interactive message kit — dual-gate (Message.type OR metadata.kind).
 * SSOT for allowlist + bubble/notify branching.
 */

import type { Message, MessageType } from '@/features/chat/types'

export const INTERACTIVE_MESSAGE_TYPES = [
  'payment_request',
  'env_request',
  'task',
  'poll',
  'rsvp',
  'dao_jar',
  'share_card',
  'game_request',
  'cart_summary',
  'product_card',
] as const

export type InteractiveMessageType = (typeof INTERACTIVE_MESSAGE_TYPES)[number]

/** API + MessageService allowlist — base media/system + interactive. */
export const MESSAGE_TYPE_ALLOWLIST: readonly MessageType[] = [
  'text',
  'image',
  'file',
  'system',
  ...INTERACTIVE_MESSAGE_TYPES,
]

export function getMessageKind(
  message: Pick<Message, 'type' | 'metadata'>,
): string | undefined {
  const kind = message.metadata?.kind
  if (typeof kind === 'string' && kind.length > 0) return kind
  return message.type
}

/** True when type OR metadata.kind matches (payment_request dual-gate pattern). */
export function isInteractiveKind(
  message: Pick<Message, 'type' | 'metadata'>,
  kind: InteractiveMessageType,
): boolean {
  return message.type === kind || message.metadata?.kind === kind
}

export function isAnyInteractive(message: Pick<Message, 'type' | 'metadata'>): boolean {
  return INTERACTIVE_MESSAGE_TYPES.some((kind) => isInteractiveKind(message, kind))
}

export function resolveInteractiveKind(
  message: Pick<Message, 'type' | 'metadata'>,
): InteractiveMessageType | null {
  for (const kind of INTERACTIVE_MESSAGE_TYPES) {
    if (isInteractiveKind(message, kind)) return kind
  }
  return null
}
