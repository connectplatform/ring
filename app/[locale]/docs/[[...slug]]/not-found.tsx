import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { FileQuestion, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

export default async function DocsNotFoundPage() {
  const locale = routing.defaultLocale as Locale
  const t = await getTranslations({ locale, namespace: 'docs.notFound' })

  return (
    <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
        <Button asChild>
          <Link href="/docs">
            <Home className="mr-2 h-4 w-4" />
            {t('backToDocs')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
