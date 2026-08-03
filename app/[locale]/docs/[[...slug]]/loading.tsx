import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'

/** Instant docs route fallback — must follow active locale (was hardcoded Ukrainian). */
export default async function Loading() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'docs.loading' })

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Image
            src="/logo.svg"
            alt={t('logoAlt')}
            width={64}
            height={64}
            className="w-16 h-16 animate-pulse"
            priority
          />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex space-x-1" aria-hidden>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}
