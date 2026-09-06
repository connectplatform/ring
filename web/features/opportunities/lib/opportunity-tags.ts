const MACHINE_TAG_PREFIXES = new Set([
  'sourcemessageid',
  'sourceconversationid',
  'sourcetaskkind',
])

export type OpportunityChatProvenance = {
  kind: 'chat_task'
  messageId?: string
  conversationId?: string
}

export type SplitOpportunityTags = {
  visibleTags: string[]
  provenance: OpportunityChatProvenance | null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parseLegacyMachineTag(tag: string): { key: string; value: string } | null {
  const colon = tag.indexOf(':')
  if (colon <= 0) return null
  const key = tag.slice(0, colon).trim()
  const value = tag.slice(colon + 1).trim()
  if (!key || !value) return null
  if (!MACHINE_TAG_PREFIXES.has(key.toLowerCase())) return null
  return { key: key.toLowerCase(), value }
}

function metadataSource(opportunity: {
  metadata?: Record<string, unknown>
}): OpportunityChatProvenance | null {
  const source = opportunity.metadata?.source
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  const bag = source as Record<string, unknown>
  const kind = readString(bag.kind)
  if (kind !== 'chat_task') return null
  return {
    kind: 'chat_task',
    messageId: readString(bag.messageId),
    conversationId: readString(bag.conversationId),
  }
}

/**
 * Split user-facing tags from chat-task provenance (metadata.source or legacy encoded tags).
 */
export function splitOpportunityTags(opportunity: {
  tags?: string[]
  metadata?: Record<string, unknown>
}): SplitOpportunityTags {
  const tags = Array.isArray(opportunity.tags) ? opportunity.tags : []
  const visibleTags: string[] = []
  let messageId: string | undefined
  let conversationId: string | undefined
  let chatTask = false

  for (const raw of tags) {
    const tag = String(raw || '').trim()
    if (!tag) continue
    if (tag.toLowerCase() === 'chat_task') {
      chatTask = true
      continue
    }
    const machine = parseLegacyMachineTag(tag)
    if (machine) {
      if (machine.key === 'sourcemessageid') messageId = machine.value
      if (machine.key === 'sourceconversationid') conversationId = machine.value
      if (machine.key === 'sourcetaskkind' && machine.value === 'chat_task') chatTask = true
      continue
    }
    visibleTags.push(tag)
  }

  const fromMetadata = metadataSource(opportunity)
  const provenance: OpportunityChatProvenance | null = fromMetadata
    ? fromMetadata
    : chatTask || messageId || conversationId
      ? { kind: 'chat_task', messageId, conversationId }
      : null

  return { visibleTags, provenance }
}
