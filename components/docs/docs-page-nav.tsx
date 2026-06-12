import type { ComponentProps } from 'react'
import { Link } from '@/i18n/routing'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

type DocsPageNavProps = {
  slug: string[]
  showOnDesktop?: boolean
}

type DocsLinkHref = ComponentProps<typeof Link>['href']

function parentDocsHref(slug: string[]): DocsLinkHref {
  if (slug.length <= 1) return '/docs'
  // Docs slugs are not enumerated in sharedPathnames; cast matches back-bar / router.push pattern.
  return `/docs/${slug.slice(0, -1).join('/')}` as DocsLinkHref
}

export async function DocsPageNav({ slug, showOnDesktop = true }: DocsPageNavProps) {
  const t = await getTranslations('common')
  const href = parentDocsHref(slug)

  return (
    <div
      className={`sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm ${showOnDesktop ? '' : 'lg:hidden'}`}
    >
      <div className="container mx-auto px-4 py-3">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('actions.back', { defaultValue: 'Back' })}
        </Link>
      </div>
    </div>
  )
}
