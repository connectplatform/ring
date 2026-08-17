/**
 * crm-ops router — post-intent actions on EmailProcessor rails.
 * Does NOT implement crm-spammer-osint; only flags + tasks + draft guidance.
 */

import type { EmailIntent, IntentClassification } from './intent-classifier'
import type { ParsedEmail } from '../parser/email-parser'
import { logger } from '@/lib/logger'

export type CrmOpsRouteFlag = 'spam_osint_queue' | 'crm_email_lead' | null

export interface CrmOpsRouteTask {
  title: string
  description: string
  taskType: 'follow_up' | 'escalation' | 'action_required' | 'review' | 'unsubscribe_pending'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dueDays: number
  triggerReason: string
}

export interface CrmOpsRouteResult {
  routeFlag: CrmOpsRouteFlag
  skipDraft: boolean
  unsubscribeUrl: string | null
  draftGuidance: string | null
  tasks: CrmOpsRouteTask[]
}

const LEAD_INTENTS: EmailIntent[] = [
  'demo_request',
  'enterprise_inquiry',
  'partnership',
  'pricing_inquiry',
  'feature_request',
  'getting_started',
]

const RINGDOM_OFFER_GUIDANCE = `Craft a warm reply for a vendor/partner offer that Ringdom can serve.

Structure (keep under ~250 words):
1. Thank them sincerely for interest in Ringdom / Ring Platform.
2. Show you understood their offer in 1–2 sentences (no inventing features they did not claim).
3. Good news: they can share the offer on Ringdom via opportunities / store vendor / white-label ring paths as appropriate.
4. Brief steps:
   - Create or sign in at the Ring (ringdom.org or the relevant white-label).
   - Open Opportunities or Store (vendor onboarding) depending on the offer type.
   - Publish listing / request partnership; our team reviews high-value partnerships.
5. Offer a human follow-up if they prefer; do NOT promise pricing or SLAs.
6. Never auto-claim the offer is accepted.

Tone: warm, professional, concise. No markdown tables.`

/**
 * Extract List-Unsubscribe HTTP(S) URL from headers and/or body.
 * Never auto-fetch — human or allowlisted one-click later.
 */
export function extractUnsubscribeUrl(
  rawHeaders: Record<string, string> | undefined,
  body: string
): string | null {
  const headerVal = findHeader(rawHeaders, 'list-unsubscribe')
  if (headerVal) {
    const fromHeader = firstHttpsFromListUnsubscribe(headerVal)
    if (fromHeader) return fromHeader
  }

  const oneClick = findHeader(rawHeaders, 'list-unsubscribe-post')
  if (oneClick && headerVal) {
    const again = firstHttpsFromListUnsubscribe(headerVal)
    if (again) return again
  }

  const bodyMatch = body.match(
    /https?:\/\/[^\s<>"']+(?:unsubscribe|opt[_-]?out|email[_-]?preferences)[^\s<>"']*/i
  )
  return bodyMatch?.[0]?.replace(/[)>.,;]+$/, '') ?? null
}

function findHeader(
  headers: Record<string, string> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

function firstHttpsFromListUnsubscribe(value: string): string | null {
  const angle = [...value.matchAll(/<(https?:\/\/[^>]+)>/gi)].map((m) => m[1])
  const bare = [...value.matchAll(/https?:\/\/[^\s,>]+/gi)].map((m) => m[0])
  const candidates = [...angle, ...bare]
  return candidates.find((u) => /^https?:\/\//i.test(u)) ?? null
}

export function routeCrmOps(params: {
  intent: IntentClassification
  parsed: ParsedEmail
  isFirstContact: boolean
}): CrmOpsRouteResult {
  const { intent, parsed, isFirstContact } = params
  const unsubscribeUrl = extractUnsubscribeUrl(parsed.rawHeaders, parsed.bodyTextClean || '')

  if (intent.intent === 'newsletter_subscription') {
    const tasks: CrmOpsRouteTask[] = [
      {
        title: `Unsubscribe pending: ${parsed.subject.slice(0, 80)}`,
        description: unsubscribeUrl
          ? `Review and unsubscribe via: ${unsubscribeUrl}\nThen queue EML for future OSINT (spam_osint_queue).`
          : 'No List-Unsubscribe URL found — search body/headers manually, then queue for OSINT.',
        taskType: 'unsubscribe_pending',
        priority: 'low',
        dueDays: 2,
        triggerReason: 'crm-ops:newsletter_subscription',
      },
    ]
    logger.info('[crm-ops] newsletter_subscription → unsubscribe + osint flag', {
      messageId: parsed.messageId,
      hasUnsubscribe: Boolean(unsubscribeUrl),
    })
    return {
      routeFlag: 'spam_osint_queue',
      skipDraft: true,
      unsubscribeUrl,
      draftGuidance: null,
      tasks,
    }
  }

  if (intent.intent === 'vendor_offer_irrelevant') {
    logger.info('[crm-ops] irrelevant offer → osint flag', {
      messageId: parsed.messageId,
    })
    return {
      routeFlag: 'spam_osint_queue',
      skipDraft: true,
      unsubscribeUrl,
      draftGuidance: null,
      tasks: [
        {
          title: `OSINT queue: ${parsed.from.email}`,
          description: `Flagged vendor_offer_irrelevant from cold/unrelated pitch. Deferred crm-spammer-osint consumer.`,
          taskType: 'review',
          priority: 'low',
          dueDays: 7,
          triggerReason: 'crm-ops:vendor_offer_irrelevant',
        },
      ],
    }
  }

  if (intent.intent === 'spam') {
    // Flag for future OSINT; do not create a task per spam (inbox flood).
    logger.info('[crm-ops] spam → osint flag (no task)', {
      messageId: parsed.messageId,
    })
    return {
      routeFlag: 'spam_osint_queue',
      skipDraft: true,
      unsubscribeUrl,
      draftGuidance: null,
      tasks: [],
    }
  }

  if (intent.intent === 'vendor_offer_ring_relevant') {
    logger.info('[crm-ops] ring-relevant offer → warm draft (review)', {
      messageId: parsed.messageId,
      isFirstContact,
    })
    return {
      routeFlag: 'crm_email_lead',
      skipDraft: false,
      unsubscribeUrl,
      draftGuidance: RINGDOM_OFFER_GUIDANCE,
      tasks: [
        {
          title: `Ringdom offer lead: ${parsed.from.name || parsed.from.email}`,
          description: `Vendor/offer may fit Ringdom surfaces. Review warm draft before send.${
            isFirstContact ? ' New sender — never auto-send.' : ''
          }`,
          taskType: 'follow_up',
          priority: 'normal',
          dueDays: 2,
          triggerReason: 'crm-ops:vendor_offer_ring_relevant',
        },
      ],
    }
  }

  if (LEAD_INTENTS.includes(intent.intent)) {
    return {
      routeFlag: 'crm_email_lead',
      skipDraft: false,
      unsubscribeUrl,
      draftGuidance: null,
      tasks: [],
    }
  }

  return {
    routeFlag: null,
    skipDraft: false,
    unsubscribeUrl,
    draftGuidance: null,
    tasks: [],
  }
}
