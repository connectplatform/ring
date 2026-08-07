'use client'

/**
 * LAYER1 community stub — Order Lab env_request UI lives under features/crm/lab (overlay).
 * Clones/empire that ship CRM should overlay this file to re-export the lab widget.
 */
import type { Message } from '@/features/chat/types'

export function EnvRequestMessageWidget(_props: {
  message: Message
  isOwn: boolean
  className?: string
}) {
  return null
}
