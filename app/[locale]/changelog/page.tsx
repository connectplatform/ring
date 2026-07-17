import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import ChangelogWrapper from '@/components/wrappers/changelog-wrapper'
import { ChangelogArticle } from '@/components/pages/changelog-article'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import type { LocalePageProps } from '@/utils/page-props'
import { renderChangelogHtml } from '@/lib/changelog/render-changelog'
import { getPlatformIdentity, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import packageInfo from '@/package.json'

type ChangelogParams = Record<string, never>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'changelog',
    pathname: '/changelog',
  })
}

export default async function ChangelogPage(props: LocalePageProps<ChangelogParams>) {
  await connection()

  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  setRequestLocale(locale)

  const tNav = await getTranslations({ locale, namespace: 'navigation' })
  const identity = getPlatformIdentity()
  const clone = getSystemConfigSnapshot().clone
  const { html } = await renderChangelogHtml()

  const publisherName = tNav('sidebar.appPublisher')
  const projectName = identity.name
  const projectDescription =
    clone?.description ??
    'Open-source white-label community, opportunity, and marketplace platform.'
  const version = packageInfo.version
  const organization = clone?.organization
  const contactEmail = clone?.contactEmail ?? identity.demoUserEmail

  return (
    <ChangelogWrapper
      locale={locale}
      publisherName={publisherName}
      projectName={projectName}
      projectDescription={projectDescription}
      version={version}
      organization={organization}
      contactEmail={contactEmail}
    >
      <ChangelogArticle
        html={html}
        title={tNav('changelog.title')}
        subtitle={tNav('changelog.subtitle', { version })}
      />
    </ChangelogWrapper>
  )
}
