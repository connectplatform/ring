import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import Image from 'next/image'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { auth } from '@/auth'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getRingConfig } from '@/lib/ring-config'
import { connection } from 'next/server'

type ContactPageParams = Record<string, never>

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

  const ringConfig = getRingConfig()
  const contactInfo = ringConfig.contact
  const platformVars = {
    platform: ringConfig.clone.displayName,
    description: ringConfig.clone.description ?? ringConfig.seo?.siteDescription ?? '',
  }

  const t = await getTranslations('contact')
  const session = await auth()
  const partners = contactInfo?.partners ?? []

  return (
    <AboutWrapper locale={locale}>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Typography variant="h1" className="text-4xl font-bold mb-12 text-center text-primary">
          {t('title', platformVars)}
        </Typography>

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {t('getInTouch')}
            </Typography>
            <Typography variant="p" className="mb-6 text-muted-foreground">
              {t('description')}
            </Typography>
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
          </CardContent>
        </Card>

        {(contactInfo?.address || contactInfo?.phone || contactInfo?.email) && (
          <Card className="mb-12">
            <CardContent className="pt-6">
              <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
                {t('contactInformation')}
              </Typography>
              {contactInfo?.address && (
                <Typography variant="p" className="mb-2 text-muted-foreground">
                  {contactInfo.address}
                </Typography>
              )}
              {contactInfo?.phone && (
                <Typography variant="p" className="mb-2 text-muted-foreground">
                  {t('phoneLabel')}: {contactInfo.phone}
                </Typography>
              )}
              {contactInfo?.email && (
                <Typography variant="p" className="mb-6 text-muted-foreground">
                  {t('emailLabel')}: {contactInfo.email}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {t('faq')}
            </Typography>
            <div className="space-y-4">
              {CONTACT_FAQ_ITEMS.map(({ questionKey, answerKey }) => (
                <div key={questionKey}>
                  <Typography variant="h3" className="text-lg font-semibold mb-2 text-primary">
                    {t(questionKey, platformVars)}
                  </Typography>
                  <Typography variant="p" className="text-muted-foreground">
                    {t(answerKey, platformVars)}
                  </Typography>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {partners.length > 0 && (
          <Card className="mb-12">
            <CardContent className="pt-6">
              <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
                {t('partners')}
              </Typography>
              <div className="overflow-x-auto">
                <div className="flex space-x-6 pb-4">
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
            </CardContent>
          </Card>
        )}
      </div>
    </AboutWrapper>
  )
}
