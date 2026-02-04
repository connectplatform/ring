import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildMessages } from '@/lib/i18n'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const messages = await buildMessages(locale);
  const t = messages['aiWeb3'] || {};

  return {
    title: t.title || 'AI Meets Web3 - Ring Platform',
    description: t.description || 'Exploring the convergence of artificial intelligence and Web3 technologies in the Ring Platform for decentralized collective intelligence.',
    keywords: ['AI', 'Web3', 'Blockchain', 'Artificial Intelligence', 'Decentralized', 'Ring Platform', 'Collective Intelligence', 'Smart Contracts'],
  }
}

export default async function AIWeb3Page({ params }: Props) {
  const { locale: localeParam } = await params;
  const locale = localeParam as 'en' | 'uk' | 'ru';

  if (!['en', 'uk', 'ru'].includes(localeParam)) {
    notFound()
  }

  const messages = await buildMessages(locale);
  const t = messages['aiWeb3'] || {};

  return (
    <AboutWrapper locale={locale}>
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
      <div className="grid md:grid-cols-2 gap-8 mb-16">
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
      <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border border-border">
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
              <span className="text-xl">🔐</span>
                </div>
            <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.fusion?.trust?.title || 'Trustless AI'}
                </h3>
            <p className="text-sm text-muted-foreground">
              {t.fusion?.trust?.description || 'AI decisions recorded on blockchain for complete transparency and auditability'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">💰</span>
            </div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.fusion?.incentives?.title || 'Token Incentives'}
                </h3>
                <p className="text-sm text-muted-foreground">
              {t.fusion?.incentives?.description || 'AI-driven token distribution rewards meaningful contributions automatically'}
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🌐</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.fusion?.decentralized?.title || 'Decentralized Intelligence'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.fusion?.decentralized?.description || 'AI models trained on community data, owned and governed by the community'}
            </p>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
          {t.useCases?.title || 'Real-World Applications'}
            </h2>

        <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🎯</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
              {t.useCases?.matching?.title || 'Intelligent Matching'}
                </h3>
                <p className="text-muted-foreground">
              {t.useCases?.matching?.description || 'AI algorithms match opportunities with the right people, verified by blockchain reputation systems.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-4">
              <span className="text-white text-xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
              {t.useCases?.analytics?.title || 'Predictive Analytics'}
                </h3>
                <p className="text-muted-foreground">
              {t.useCases?.analytics?.description || 'AI-powered insights help communities make better decisions about resource allocation and project priorities.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
              <span className="text-white text-xl">🗳️</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
              {t.useCases?.governance?.title || 'Smart Governance'}
                </h3>
                <p className="text-muted-foreground">
              {t.useCases?.governance?.description || 'AI assists in analyzing proposals while smart contracts ensure transparent, automated execution of community decisions.'}
                </p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 flex items-center justify-center mb-4">
              <span className="text-white text-xl">🛡️</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
              {t.useCases?.security?.title || 'Enhanced Security'}
                </h3>
                <p className="text-muted-foreground">
              {t.useCases?.security?.description || 'AI-powered fraud detection combined with blockchain immutability creates robust security for digital interactions.'}
                </p>
              </div>
            </div>
          </div>

          {/* Technical Architecture */}
      <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
              {t.architecture?.title || 'Technical Architecture'}
            </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-3xl mb-4">🔗</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.architecture?.layer1?.title || 'Blockchain Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
              {t.architecture?.layer1?.description || 'Polygon for fast, low-cost transactions with Ethereum security'}
                </p>
              </div>

          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-3xl mb-4">🧠</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.architecture?.layer2?.title || 'AI Processing Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
              {t.architecture?.layer2?.description || 'Advanced NLP and ML models for intelligent matching and analysis'}
                </p>
              </div>

          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-3xl mb-4">💻</div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
              {t.architecture?.layer3?.title || 'Application Layer'}
                </h3>
                <p className="text-sm text-muted-foreground">
              {t.architecture?.layer3?.description || 'React 19 + Next.js 15 for seamless user experience'}
                </p>
              </div>
            </div>
          </div>

          {/* Future Vision */}
      <div className="bg-gradient-to-r from-cyan-600 to-purple-600 rounded-2xl p-8 text-white mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">
          {t.vision?.title || 'The Future We\'re Building'}
            </h2>

        <Steps>
          <Step>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.vision?.phase1?.title || 'Intelligent Collaboration'}
                </h3>
                <p className="opacity-90">
                  {t.vision?.phase1?.description || 'AI-assisted matching of skills, interests, and opportunities across the platform'}
                </p>
              </div>
                  </div>
                </Step>

                <Step>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">2</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.vision?.phase2?.title || 'Autonomous Organizations'}
            </h3>
                <p className="opacity-90">
                  {t.vision?.phase2?.description || 'Self-governing DAOs powered by AI decision support and smart contract execution'}
                </p>
              </div>
            </div>
          </Step>

          <Step>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.vision?.phase3?.title || 'Global Collective Intelligence'}
              </h3>
                <p className="opacity-90">
                  {t.vision?.phase3?.description || 'A world where AI and humans collaborate seamlessly to solve humanity\'s greatest challenges'}
              </p>
              </div>
            </div>
          </Step>
        </Steps>
        </div>

      {/* Call to Action */}
      <div className="text-center">
        <div className="bg-card rounded-2xl p-8 shadow-lg border">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-600 to-purple-600 bg-clip-text text-transparent">
            {t.cta?.title || 'Join the AI + Web3 Revolution'}
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            {t.cta?.subtitle || 'Be part of building the future of decentralized collective intelligence.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/${locale}/`}
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-purple-700 transition-colors"
            >
              {t.cta?.getStarted || 'Get Started'}
            </a>
            <a
              href={`/${locale}/docs`}
              className="inline-flex items-center justify-center px-8 py-3 bg-card text-card-foreground font-semibold rounded-lg border hover:bg-muted transition-colors"
            >
              {t.cta?.learnMore || 'Learn More'}
              </a>
            </div>
          </div>
        </div>
    </AboutWrapper>
  )
}
