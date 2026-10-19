import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { auth } from '@/auth'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getRingSeoBranding, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { connection } from 'next/server'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'

type ContactPageParams = Record<string, never>

/** Horizontal inset for text/CTAs — mirrors about-publisher's compact form/legal recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

/** Universal contact-page FAQ slots — clone locales override copy; keys stay stable across Ring deployments. */
const CONTACT_FAQ_ITEMS = [
  { questionKey: 'faqWhatIs', answerKey: 'faqWhatIsAnswer' },
  { questionKey: 'faqGetStarted', answerKey: 'faqGetStartedAnswer' },
  { questionKey: 'faqResponseTime', answerKey: 'faqResponseTimeAnswer' },
  { questionKey: 'faqInquiries', answerKey: 'faqInquiriesAnswer' },
] as const

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
    path: 'contact',
    pathname: '/contact',
  })
}

export default async function ContactPage(props: LocalePageProps<ContactPageParams>) {
  await connection()

  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  setRequestLocale(locale)

  const ringSeoBranding = getRingSeoBranding()
  const contactInfo = getSystemConfigSnapshot().contact
  const platformVars = {
    platform: getRingSeoBranding().siteName,
    description: getSystemConfigSnapshot().seo?.siteDescription ?? '',
  }

  const t = await getTranslations('contact')
  const session = await auth()
  const partners = contactInfo?.partners ?? []

  return (
    <AboutWrapper locale={locale}>
      <div className="w-full min-w-0">
        <div className={cn('mx-auto max-w-4xl pb-6 pt-4 text-center sm:pt-6', INSET)}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('title', platformVars)}
          </h1>
        </div>

        <div className={cn('mx-auto max-w-4xl space-y-6 pb-10', INSET)}>
          <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
            <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{t('getInTouch')}</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('description')}
            </p>
            <Suspense fallback={<div>{t('loadingForm')}</div>}>
              <ContactForm
                entityId="contact_page"
                entityName="Contact Page"
                initialUserInfo={{
                  name: session?.user?.name || '',
                  email: session?.user?.email || '',
                }}
              />
            </Suspense>
          </div>

          {(contactInfo?.address || contactInfo?.phone || contactInfo?.email) && (
            <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
              <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
                {t('contactInformation')}
              </h2>
              {contactInfo?.address && (
                <p className="mb-2 text-sm text-muted-foreground sm:text-base">
                  {contactInfo.address}
                </p>
              )}
              {contactInfo?.phone && (
                <p className="mb-2 text-sm text-muted-foreground sm:text-base">
                  {t('phoneLabel')}: {contactInfo.phone}
                </p>
              )}
              {contactInfo?.email && (
                <p className="text-sm text-muted-foreground sm:text-base">
                  {t('emailLabel')}: {contactInfo.email}
                </p>
              )}
            </div>
          )}

          <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
            <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{t('faq')}</h2>
            <div className="space-y-4">
              {CONTACT_FAQ_ITEMS.map(({ questionKey, answerKey }) => (
                <div key={questionKey}>
                  <h3 className="mb-1.5 text-base font-semibold sm:text-lg">
                    {t(questionKey, platformVars)}
                  </h3>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    {t(answerKey, platformVars)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {partners.length > 0 && (
            <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
              <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{t('partners')}</h2>
              <div className="overflow-x-auto">
                <div className="flex space-x-6 pb-2">
                  {partners.map((partner) => (
                    <div key={partner.name} className="flex-shrink-0">
                      <Image
                        src={partner.logo || '/placeholder.svg'}
                        alt={partner.name}
                        width={200}
                        height={100}
                        className="object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AboutWrapper>
  )
}
