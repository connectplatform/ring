import { headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { buildMessages } from '@/lib/i18n'
import { resolveMessageScope } from '@/lib/i18n/message-scopes'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? routing.defaultLocale
  const finalLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale

  const headersList = await headers()
  let pathname = headersList.get('x-pathname')
  if (!pathname) {
    const xUrl = headersList.get('x-url')
    if (xUrl) {
      try {
        pathname = new URL(xUrl).pathname
      } catch {
        /* ignore malformed x-url */
      }
    }
  }
  // Missing path headers → avoid shrinking to public-home (drops route-specific namespaces).
  const scope = pathname ? resolveMessageScope(pathname) : 'public'

  return {
    locale: finalLocale,
    messages: await buildMessages(finalLocale, scope),
  }
})
