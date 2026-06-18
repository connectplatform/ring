import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { buildMessages, getMessageSection } from '@/lib/i18n'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

import { Callout } from '@/components/docs/callout'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'

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
    path: 'ai-web3',
    pathname: '/ai-web3',
  })
}

export default async function AIWeb3Page({ params }: Props) {
  await connection()

  const { locale: localeParam } = await params
  if (!routing.locales.includes(localeParam as Locale)) {
    notFound()
  }
  const locale = localeParam as Locale
  setRequestLocale(locale)

  const messages = await buildMessages(locale, 'public')
  const t = getMessageSection(messages, 'ai-web3')

  return (
    <AboutWrapper locale={locale}>
        {/* Main Content */}
        <div className="py-0">
        
        {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-100 to-purple-100 dark:from-cyan-900/30 dark:to-purple-900/30 rounded-full px-4 py-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"></div>
              <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                {t.badge || 'AI + Web3'}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-cyan-600 via-purple-500 to-blue-600 bg-clip-text text-transparent mb-6">
              {t.hero?.title || 'AI Meets Web3: The Future of Collective Intelligence'}
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t.hero?.subtitle || 'Ring Platform combines artificial intelligence with Web3 technologies to create decentralized, autonomous systems for collective problem-solving.'}
            </p>
          </div>

          {/* Core Concept */}
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center mb-6">
                <span className="text-3xl">🤖</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-card-foreground">
                {t.concept?.ai?.title || 'Artificial Intelligence'}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t.concept?.ai?.description || 'Advanced machine learning algorithms that understand context, match opportunities with expertise, and facilitate collective problem-solving.'}
              </p>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-6">
                <span className="text-3xl">⛓️</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-card-foreground">
                {t.concept?.web3?.title || 'Web3 Technologies'}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t.concept?.web3?.description || 'Decentralized blockchain networks, smart contracts, and token economies that ensure transparency, trust, and community ownership.'}
              </p>
            </div>
          </div>

          {/* The Fusion */}
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg mb-16 border border-border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
              {t.fusion?.title || 'The Perfect Fusion'}
            </h2>

            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-full px-6 py-3 text-white font-semibold">
                <span className="text-2xl">🤖</span>
                <span className="text-xl">+</span>
                <span className="text-2xl">⛓️</span>
                <span className="text-xl">=</span>
                <span className="text-2xl">🚀</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-lg">🧠</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 text-card-foreground">
                  {t.fusion?.intelligence?.title || 'Collective Intelligence'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t.fusion?.intelligence?.description || 'AI algorithms amplify human intelligence by connecting the right people at the right time'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-lg">🔒</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 text-card-foreground">
                  {t.fusion?.trust?.title || 'Decentralized Trust'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t.fusion?.trust?.description || 'Blockchain ensures transparency and prevents manipulation of collaborative processes'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-lg">⚡</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 text-card-foreground">
                  {t.fusion?.automation?.title || 'Smart Automation'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t.fusion?.automation?.description || 'Intelligent systems handle complex matching and coordination tasks autonomously'}
                </p>
              </div>
            </div>
          </div>

          {/* Ring's AI-Web3 Features */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
              {t.features?.title || 'Ring\'s AI-Web3 Features'}
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🎯</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.features?.smartMatching?.title || 'AI-Powered Matching'}
                </h3>
                <p className="text-muted-foreground">
                  {t.features?.smartMatching?.description || 'Machine learning algorithms match opportunities with the most qualified participants based on skills, experience, and past performance.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🔗</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.features?.decentralized?.title || 'Decentralized Governance'}
                </h3>
                <p className="text-muted-foreground">
                  {t.features?.decentralized?.description || 'Community members vote on platform decisions using blockchain-based governance systems and token-weighted voting.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🤝</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.features?.collective?.title || 'Collective Intelligence'}
                </h3>
                <p className="text-muted-foreground">
                  {t.features?.collective?.description || 'AI facilitates the emergence of collective intelligence by connecting diverse perspectives and expertise in collaborative problem-solving.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-cyan-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🔄</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.features?.adaptive?.title || 'Adaptive Learning'}
                </h3>
                <p className="text-muted-foreground">
                  {t.features?.adaptive?.description || 'The platform continuously learns from successful collaborations to improve future matching and coordination.'}
                </p>
              </div>
            </div>
          </div>

          {/* Technical Architecture */}
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg mb-16 border border-border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
              {t.architecture?.title || 'Technical Architecture'}
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
                <div className="text-2xl mb-3">⚛️</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                  {t.architecture?.frontend?.title || 'Frontend Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.architecture?.frontend?.description || 'React 19 + Next.js 15 interface providing seamless user experience'}
                </p>
              </div>

              <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
                <div className="text-2xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                  {t.architecture?.ai?.title || 'AI Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.architecture?.ai?.description || 'Machine learning algorithms for intelligent matching and coordination'}
                </p>
              </div>

              <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
                <div className="text-2xl mb-3">⛓️</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                  {t.architecture?.blockchain?.title || 'Blockchain Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.architecture?.blockchain?.description || 'Web3 protocols ensuring decentralized trust and transparency'}
                </p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-muted/30 border border-border rounded-xl">
              <h3 className="text-lg font-semibold mb-3 text-center text-card-foreground">
                {t.architecture?.integration?.title || 'Integration Layer'}
              </h3>
              <p className="text-center text-muted-foreground">
                {t.architecture?.integration?.description || 'Seamless communication between AI and blockchain components'}
              </p>
            </div>
          </div>

          {/* Future Vision */}
          <div className="bg-gradient-to-r from-cyan-600 via-purple-500 to-blue-600 rounded-2xl p-8 md:p-12 text-white mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">
              {t.future?.title || 'The Future'}
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  {t.future?.nearTerm?.title || 'Near-term Developments'}
                </h3>
                <ul className="space-y-2 opacity-90">
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-300 mt-1">•</span>
                    <span>{t.future?.nearTerm?.item1 || 'Enhanced AI matching algorithms'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-300 mt-1">•</span>
                    <span>{t.future?.nearTerm?.item2 || 'Expanded Web3 integration'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-300 mt-1">•</span>
                    <span>{t.future?.nearTerm?.item3 || 'Community governance features'}</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">
                  {t.future?.longTerm?.title || 'Long-term Vision'}
                </h3>
                <ul className="space-y-2 opacity-90">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-300 mt-1">•</span>
                    <span>{t.future?.longTerm?.item1 || 'Fully autonomous coordination systems'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-300 mt-1">•</span>
                    <span>{t.future?.longTerm?.item2 || 'Global decentralized collaboration networks'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-300 mt-1">•</span>
                    <span>{t.future?.longTerm?.item3 || 'AI-driven social innovation platforms'}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="text-center">
            <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg border border-border">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
                {t.gettingStarted?.title || 'Getting Started'}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {t.gettingStarted?.subtitle || 'Join the future of decentralized collective intelligence'}
              </p>

              <Steps>
                <Step>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold">1</span>
                    </div>
                    <span className="font-medium">{t.gettingStarted?.step1 || 'Create your account'}</span>
                  </div>
                </Step>

                <Step>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-bold">2</span>
                    </div>
                    <span className="font-medium">{t.gettingStarted?.step2 || 'Explore opportunities'}</span>
                  </div>
                </Step>

                <Step>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                      <span className="text-white font-bold">3</span>
                    </div>
                    <span className="font-medium">{t.gettingStarted?.step3 || 'Start collaborating'}</span>
                  </div>
                </Step>
              </Steps>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <a
                  href={`/${locale}/docs/getting-started`}
                  className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-purple-700 transition-colors"
                >
                  {t.gettingStarted?.cta || 'Begin Your Journey'}
                </a>
              </div>
            </div>
          </div>
        </div>
    </AboutWrapper>
  )
}
