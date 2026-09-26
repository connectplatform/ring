/**
 * Client-side glyph mapping for call system lines.
 * Server phrases come from ConversationService.recordCallSystemMessage →
 * `${actor} started a video call|started an audio call|ended the call|declined the call`
 * and the call-event route's `call failed`. English server strings are stable,
 * so matching is end-anchored and only fires on call lifecycle lines — other
 * system messages (Welcome / Group created / joined) never match.
 */

import type { LucideIcon } from 'lucide-react'
import {
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Video,
} from 'lucide-react'

export type CallSystemGlyph = {
  Icon: LucideIcon
  className: string
}

const CALL_GLYPH_PATTERNS: Array<{ re: RegExp; glyph: CallSystemGlyph }> = [
  {
    re: /started a video call$/,
    glyph: { Icon: Video, className: 'text-emerald-600 dark:text-emerald-400' },
  },
  {
    re: /started an audio call$/,
    glyph: { Icon: PhoneIncoming, className: 'text-emerald-600 dark:text-emerald-400' },
  },
  {
    re: /ended the call$/,
    glyph: { Icon: PhoneOff, className: 'text-muted-foreground' },
  },
  {
    re: /declined the call$/,
    glyph: { Icon: PhoneMissed, className: 'text-red-500' },
  },
  {
    re: /call failed$/,
    glyph: { Icon: PhoneMissed, className: 'text-red-500' },
  },
]

export function getCallSystemGlyph(content: string): CallSystemGlyph | null {
  if (!content) return null
  const text = content.toLowerCase()
  for (const { re, glyph } of CALL_GLYPH_PATTERNS) {
    if (re.test(text)) return glyph
  }
  return null
}
