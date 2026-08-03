'use client'

import { useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import { FutureFeaturePoolWidget } from '@/components/public-pools/future-feature-pool-widget'
import { ShareToChatButton } from '@/features/chat/interactive/share-to-chat-button'
import { PostDaoJarToChatButton } from '@/features/public-pools/components/post-dao-jar-to-chat-button'
import { ChevronLeft } from 'lucide-react'

export function DaoDetailClient({
  pool,
  locale,
}: {
  pool: PublicPoolDoc
  locale: Locale
}) {
  const t = useTranslations('modules.dao')
  const docPath = pool.doc_path?.trim() || 'app'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={toAppHref(ROUTES.DAO(locale))}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('detailBack')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PostDaoJarToChatButton poolSlug={pool.pool_slug} />
          <ShareToChatButton
            targetType="dao_pool"
            targetId={pool.pool_slug}
            title={pool.title}
            description={pool.description}
            url={ROUTES.DAO_POOL(pool.pool_slug, locale)}
            label={t('shareToChat')}
          />
        </div>
      </div>

      <FutureFeaturePoolWidget
        docPath={docPath}
        poolSlug={pool.pool_slug}
        name={pool.title}
        description={pool.description}
        implementationCost={pool.goal_hours}
        labels={pool.labels ?? []}
      />
    </div>
  )
}
