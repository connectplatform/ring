import 'server-only'

import { db } from '@/lib/database'
import { DEFAULT_LOCALE, isValidLocale, resolveLocale, type Locale } from '@/lib/locale-config'

type RefcodesNotifications = {
  minted?: {
    title?: string
    body?: string
  }
}

type RefcodesModule = {
  notifications?: RefcodesNotifications
}

async function loadRefcodesModule(locale: Locale): Promise<RefcodesModule> {
  try {
    return (await import(`@/locales/${locale}/modules/refcodes.json`)).default as RefcodesModule
  } catch {
    if (locale !== DEFAULT_LOCALE) {
      return loadRefcodesModule(DEFAULT_LOCALE)
    }
    return {}
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  )
}

const FALLBACK = {
  title: 'Referral reward minted',
  body: 'Your referral reward of {amount} {token} has been minted.',
}

/** Profile language only — safe for cron/minter (no next/headers). */
export async function getUserPreferredLocaleForNotifications(userId: string): Promise<Locale | null> {
  try {
    const result = await db().findDocById<Record<string, unknown>>('users', userId)
    if (!result.success || !result.data) return null

    const settings = result.data.settings as { language?: string } | undefined
    const language = settings?.language

    return language && isValidLocale(language) ? language : null
  } catch {
    return null
  }
}

export async function getReferralMintNotificationCopy(
  locale: string,
  params: { amount: string; token: string },
): Promise<{ title: string; body: string }> {
  const loc = resolveLocale(locale)
  const mod = await loadRefcodesModule(loc)
  const minted = mod.notifications?.minted
  const title = minted?.title ?? FALLBACK.title
  const bodyTemplate = minted?.body ?? FALLBACK.body

  return {
    title,
    body: interpolate(bodyTemplate, params),
  }
}
