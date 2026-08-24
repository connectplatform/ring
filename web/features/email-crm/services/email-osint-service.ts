import 'server-only'

import { resolveMx, resolveTxt } from 'node:dns/promises'
import { logger } from '@/lib/logger'
import {
  EmailThreadService,
  type EmailOsintDossier,
  type EmailThreadRecord,
} from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'

const DNS_TIMEOUT_MS = 3_000
const DEFAULT_LIMIT = 20
const SCAN_LIMIT = 200

export type EmailCrmOsintReport = {
  scanned: number
  processed: number
  skipped: number
  errors: number
}

function emailDomain(email: string | null | undefined): string | null {
  const host = String(email || '')
    .split('@')[1]
    ?.trim()
    .toLowerCase()
    .replace(/\.+$/, '')
  return host || null
}

function hostFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), DNS_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function lookupDns(domain: string): Promise<EmailOsintDossier['dns']> {
  const mxRecords = await withTimeout(
    resolveMx(domain).then((rows) =>
      rows
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((row) => row.exchange)
    ),
    [] as string[]
  )
  const txtRecords = await withTimeout(
    resolveTxt(domain).then((rows) => rows.map((parts) => parts.join(''))),
    [] as string[]
  )
  const dmarcRecords = await withTimeout(
    resolveTxt(`_dmarc.${domain}`).then((rows) => rows.map((parts) => parts.join(''))),
    [] as string[]
  )
  return {
    mx: mxRecords,
    spf: txtRecords.find((row) => /^v=spf1\b/i.test(row)) ?? null,
    dmarc: dmarcRecords.find((row) => /^v=dmarc1\b/i.test(row)) ?? null,
  }
}

async function collectHeaderHosts(thread: EmailThreadRecord & { id: string }): Promise<string[]> {
  const hosts = new Set<string>()
  const fromDomain = emailDomain(thread.fromEmail)
  if (fromDomain) hosts.add(fromDomain)
  const unsubHost = hostFromUrl(thread.unsubscribeUrl)
  if (unsubHost) hosts.add(unsubHost)
  try {
    const messages = await EmailMessageService.listByThread(thread.id)
    for (const message of messages) {
      const domain = emailDomain(message.fromEmail)
      if (domain) hosts.add(domain)
    }
  } catch (err) {
    logger.warn('[email-crm-osint] message host scan failed', {
      threadId: thread.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return [...hosts]
}

export async function buildOsintDossier(
  thread: EmailThreadRecord & { id: string }
): Promise<EmailOsintDossier> {
  const fromEmail = thread.fromEmail
  const fromDomain = emailDomain(fromEmail) ?? ''
  const headerHosts = await collectHeaderHosts(thread)
  let dns: EmailOsintDossier['dns'] = { mx: [], spf: null, dmarc: null }
  let error: string | undefined
  if (fromDomain) {
    try {
      dns = await lookupDns(fromDomain)
    } catch (err) {
      error = err instanceof Error ? err.message : 'DNS lookup failed'
    }
  } else {
    error = 'Missing from-domain'
  }
  return {
    enrichedAt: new Date().toISOString(),
    fromEmail,
    fromDomain,
    headerHosts,
    unsubscribeUrl: thread.unsubscribeUrl ?? null,
    unsubscribeOneClick: Boolean(thread.unsubscribeOneClick),
    dns,
    intent: thread.intent ?? null,
    routeReason: thread.routeFlag ?? null,
    error,
  }
}

export async function runEmailCrmOsint(options: {
  limit?: number
  force?: boolean
} = {}): Promise<EmailCrmOsintReport> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), DEFAULT_LIMIT)
  const force = Boolean(options.force)
  const threads = await EmailThreadService.listThreads({
    routeFlag: 'spam_osint_queue',
    limit: SCAN_LIMIT,
  })
  const pending = threads.filter((thread) => force || !thread.osintDossier?.enrichedAt).slice(0, limit)
  const skipped = threads.length - pending.length
  let processed = 0
  let errors = 0

  for (const thread of pending) {
    try {
      const dossier = await buildOsintDossier(thread)
      await EmailThreadService.saveOsintDossier(thread.id, dossier)
      processed += 1
      if (dossier.error) errors += 1
    } catch (err) {
      errors += 1
      logger.error('[email-crm-osint] thread enrich failed', {
        threadId: thread.id,
        error: err instanceof Error ? err.message : String(err),
      })
      try {
        await EmailThreadService.saveOsintDossier(thread.id, {
          enrichedAt: new Date().toISOString(),
          fromEmail: thread.fromEmail,
          fromDomain: emailDomain(thread.fromEmail) ?? '',
          headerHosts: [],
          unsubscribeUrl: thread.unsubscribeUrl ?? null,
          unsubscribeOneClick: Boolean(thread.unsubscribeOneClick),
          dns: { mx: [], spf: null, dmarc: null },
          intent: thread.intent ?? null,
          routeReason: thread.routeFlag ?? null,
          error: err instanceof Error ? err.message : 'OSINT enrich failed',
        })
      } catch (saveErr) {
        logger.error('[email-crm-osint] error dossier persist failed', {
          threadId: thread.id,
          error: saveErr instanceof Error ? saveErr.message : String(saveErr),
        })
      }
    }
  }

  logger.info('[email-crm-osint] batch complete', {
    scanned: threads.length,
    processed,
    skipped,
    errors,
    force,
  })
  return { scanned: threads.length, processed, skipped, errors }
}
