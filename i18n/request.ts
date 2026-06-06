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
  const pathname = headersList.get('x-pathname') ?? '/'
  const scope = resolveMessageScope(pathname)

  return {
    locale: finalLocale,
    messages: await buildMessages(finalLocale, scope),
  }
})
