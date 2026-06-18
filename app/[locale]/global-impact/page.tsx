import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { buildMessages } from '@/lib/i18n'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

import { Callout } from '@/components/docs/callout'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import RingLogoWithFlag from '@/components/common/widgets/ring-logo-with-flag'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'global-impact',
    pathname: '/global-impact',
  })
}

export default async function GlobalImpactPage({ params }: Props) {
  await connection()

  const { locale: localeParam } = await params
  if (!routing.locales.includes(localeParam as Locale)) {
    notFound()
  }
  const locale = localeParam as Locale
  setRequestLocale(locale)

  const messages = await buildMessages(locale)
  const t = messages['global-impact'] || {}

  return (
    <AboutWrapper locale={locale}>
        {/* Main Content */}
        <div className="py-0">

          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900/30 dark:to-green-900/30 border border-blue-200 dark:border-blue-800 rounded-full px-4 py-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300 transition-colors">
                {t.badge || 'Global Impact'}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-green-500 to-blue-600 bg-clip-text text-transparent mb-6">
              {t.hero?.title || 'Building a Better World Through Collective Intelligence'}
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t.hero?.subtitle || 'Ring Platform harnesses the power of AI and community collaboration to solve the world\'s most pressing challenges, from healthcare to environmental sustainability.'}
            </p>
          </div>

          {/* Impact Statistics */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">100+</div>
              <div className="text-lg font-semibold text-card-foreground mb-2">
                {t.stats?.deployments?.title || 'Ring Deployments'}
              </div>
              <p className="text-muted-foreground">
                {t.stats?.deployments?.description || 'Active Ring-powered platforms solving real problems'}
              </p>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">50K+</div>
              <div className="text-lg font-semibold text-card-foreground mb-2">
                {t.stats?.users?.title || 'Community Members'}
              </div>
              <p className="text-muted-foreground">
                {t.stats?.users?.description || 'People actively participating in collective problem solving'}
              </p>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">25+</div>
              <div className="text-lg font-semibold text-card-foreground mb-2">
                {t.stats?.countries?.title || 'Countries Impacted'}
              </div>
              <p className="text-muted-foreground">
                {t.stats?.countries?.description || 'Nations benefiting from Ring-powered solutions'}
              </p>
            </div>
          </div>

          {/* Mission Statement */}
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg mb-16 border border-border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              {t.mission?.title || 'Our Mission'}
            </h2>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  {t.mission?.description || 'Technology should unite humanity to solve our greatest challenges. Ring Platform democratizes access to AI-powered tools and collective intelligence, enabling anyone, anywhere to contribute to solutions that matter.'}
                </p>

                <Callout type="info">
                  {t.mission?.quote || 'From the ashes of conflict, we build platforms that bring peace and prosperity to the world.'}
                </Callout>
              </div>

              <div className="relative">
                <RingLogoWithFlag />
              </div>
            </div>
          </div>

          {/* Success Stories */}

          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              {t.stories?.title || 'Success Stories'}
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🏥</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.stories?.healthcare?.title || 'Healthcare Access'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.healthcare?.description || 'Ring-powered telemedicine networks connecting rural communities with medical specialists, reducing response times by 80%.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🏫</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.stories?.education?.title || 'Education Equity'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.education?.description || 'AI-driven personalized learning platforms adapting to individual student needs, improving learning outcomes by 60%.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🌱</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.stories?.environment?.title || 'Climate Action'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.environment?.description || 'Community-led environmental monitoring and conservation projects protecting biodiversity and reducing carbon emissions.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🏛️</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.stories?.governance?.title || 'Democratic Governance'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.governance?.description || 'Transparent decision-making platforms enabling citizen participation in local governance and policy development.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">💼</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.stories?.business?.title || 'Economic Development'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.business?.description || 'Blockchain-based economic models empowering communities with financial sovereignty and equitable resource distribution.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🌟</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                              {t.stories?.community?.title || 'Social Cohesion'}
                </h3>
                <p className="text-muted-foreground">
                  {t.stories?.community?.description || 'AI-powered community engagement tools fostering social inclusion and cultural preservation across diverse regions.'}
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg mb-16 border border-border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              {t.howItWorks?.title || 'How It Works'}
            </h2>

            <Steps>
              <Step>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                      {t.howItWorks?.step1?.title || 'Step 1'}
                    </h3>
                    <p className="text-muted-foreground">
                      {t.howItWorks?.step1?.description || 'Step 1 description'}
                    </p>
                  </div>
                </div>
              </Step>

              <Step>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                      {t.howItWorks?.step2?.title || 'Step 2'}
                    </h3>
                    <p className="text-muted-foreground">
                      {t.howItWorks?.step2?.description || 'Step 2 description'}
                    </p>
                  </div>
                </div>
              </Step>

              <Step>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                      {t.howItWorks?.step3?.title || 'Step 3'}
                    </h3>
                    <p className="text-muted-foreground">
                      {t.howItWorks?.step3?.description || 'Step 3 description'}
                    </p>
                  </div>
                </div>
              </Step>

              <Step>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                      {t.howItWorks?.step4?.title || 'Step 4'}
                    </h3>
                    <p className="text-muted-foreground">
                      {t.howItWorks?.step4?.description || 'Step 4 description'}
                    </p>
                  </div>
                </div>
              </Step>
            </Steps>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-8 md:p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              {t.cta?.title || 'Call to Action'}
            </h2>
            <p className="text-xl mb-8 opacity-90">
              {t.cta?.subtitle || 'Join us in building a better world through collective intelligence.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`/${locale}/about-publisher`}
                className="inline-flex items-center justify-center px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
              {t.cta?.learnMore || 'Learn More'}
              </a>
              <a
                href={`/${locale}/docs/getting-started`}
                className="inline-flex items-center justify-center px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors"
              >
                {t.cta?.getStarted || 'Get Started'}
              </a>
            </div>
          </div>

        </div>
    </AboutWrapper>
  )
}
