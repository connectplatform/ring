'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { GitPullRequestArrow } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { canProposeRevision } from '@/features/news/lib/news-collaboration-permissions'
import type { Locale } from '@/i18n/shared'

type ReviseArticleButtonProps = {
  slug: string
  locale: Locale
  status: string
  authorId: string
}

/**
 * Shown on published articles for members (not the author — they use Edit).
 */
export function ReviseArticleButton({
  slug,
  locale,
  status,
  authorId,
}: ReviseArticleButtonProps) {
  const t = useTranslations('news')
  const { data: session, status: sessionStatus } = useSession()
  if (sessionStatus !== 'authenticated' || !session?.user?.id) return null
  if (status !== 'published') return null
  if (session.user.id === authorId) return null
  if (!canProposeRevision(session.user.role)) return null

  return (
    <Button variant="secondary" size="sm" asChild>
      <Link href={ROUTES.NEWS_REVISE(slug, locale)}>
        <GitPullRequestArrow className="mr-2 h-4 w-4" />
        {t('revise.button')}
      </Link>
    </Button>
  )
}
