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
  const t = messages['tokenomics'] || {};

  return {
    title: t.title || 'Tokenomics - RING Economy',
    description: t.description || 'Understanding the RING token economy, distribution, and utility within the Ring Platform ecosystem.',
    keywords: ['Ring Token', 'RING', 'Tokenomics', 'Web3', 'Blockchain', 'Cryptocurrency', 'Digital Economy', 'Decentralized Finance'],
  }
}

export default async function TokenEconomyPage({ params }: Props) {
  const { locale: localeParam } = await params;
  const locale = localeParam as 'en' | 'uk' | 'ru';

  if (!['en', 'uk', 'ru'].includes(localeParam)) {
    notFound()
  }

  const messages = await buildMessages(locale);
  const t = messages['tokenomics'] || {};

  return (
    <AboutWrapper locale={locale}>
      {/* Hero Section */}
      <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full px-4 py-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              {t.badge || 'Token Economy'}
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-blue-500 to-green-500 bg-clip-text text-transparent mb-6">
            {t.hero?.title || 'The RING Token Ecosystem'}
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t.hero?.subtitle || 'Discover how the RING token powers decentralized collaboration, incentivizes innovation, and creates sustainable economic models for digital communities.'}
          </p>
        </div>

        {/* Token Overview */}
      <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-6">
              <span className="text-3xl">💎</span>
            </div>
            <h3 className="text-2xl font-bold mb-4 text-card-foreground">
              {t.overview?.whatIsRing?.title || 'What is RING?'}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t.overview?.whatIsRing?.description || 'RING is the native utility token of the Ring Platform, designed to facilitate microtransactions, AI service access, and platform governance.'}
            </p>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mb-6">
              <span className="text-3xl">🔗</span>
            </div>
            <h3 className="text-2xl font-bold mb-4 text-card-foreground">
              {t.overview?.utility?.title || 'Token Utility'}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t.overview?.utility?.description || 'RING tokens enable premium features, content creation incentives, and community-driven decision making across the platform.'}
            </p>
          </div>
        </div>

        {/* Token Distribution */}
      <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border border-border">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {t.distribution?.title || 'Token Distribution'}
          </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">40%</div>
              <div className="text-sm font-medium text-card-foreground mb-1">
                {t.distribution?.community?.title || 'Community Pool'}
              </div>
              <div className="text-xs text-muted-foreground">
              {t.distribution?.community?.description || 'Rewards for platform participation'}
              </div>
            </div>

            <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">30%</div>
              <div className="text-sm font-medium text-card-foreground mb-1">
                {t.distribution?.liquidity?.title || 'Liquidity Pool'}
              </div>
              <div className="text-xs text-muted-foreground">
              {t.distribution?.liquidity?.description || 'DEX liquidity incentives'}
              </div>
            </div>

            <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">20%</div>
              <div className="text-sm font-medium text-card-foreground mb-1">
                {t.distribution?.development?.title || 'Development Fund'}
              </div>
              <div className="text-xs text-muted-foreground">
              {t.distribution?.development?.description || 'Platform development'}
              </div>
            </div>

            <div className="text-center p-6 rounded-xl bg-muted/30 border border-border">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">10%</div>
              <div className="text-sm font-medium text-card-foreground mb-1">
                {t.distribution?.team?.title || 'Team & Advisors'}
              </div>
              <div className="text-xs text-muted-foreground">
              {t.distribution?.team?.description || '4-year vesting'}
                </div>
              </div>
            </div>
          </div>

          {/* How to Use RING */}
          <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {t.usage?.title || 'How to Use RING'}
            </h2>

        <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">📝</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.usage?.listing?.title || 'Opportunity Listings'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.usage?.listing?.description || 'Post opportunities, services, and projects on the platform'}
                </p>
                <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {t.usage?.listing?.cost || '0.1-1.0 RING per listing'}
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🤖</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.usage?.aiFeatures?.title || 'AI Features'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.usage?.aiFeatures?.description || 'Access premium AI-powered matching and analysis tools'}
                </p>
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t.usage?.aiFeatures?.cost || '0.01-0.1 RING per request'}
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-purple-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">🏪</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.usage?.store?.title || 'Store Transactions'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.usage?.store?.description || 'Purchase digital goods, services, and premium features'}
                </p>
                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                  {t.usage?.store?.cost || 'Variable based on item value'}
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-lg border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center mb-4">
                  <span className="text-white text-xl">⭐</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.usage?.premium?.title || 'Premium Membership'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.usage?.premium?.description || 'Enhanced platform features and priority support'}
                </p>
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  {t.usage?.premium?.cost || '10 RING per month'}
                </div>
              </div>
            </div>
          </div>

          {/* Economic Model */}
      <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {t.economics?.title || 'Economic Model'}
            </h2>

        <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📈</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.economics?.inflation?.title || 'Controlled Inflation'}
                </h3>
                <p className="text-muted-foreground">
                  {t.economics?.inflation?.description || 'Annual inflation of 2-5% to reward long-term holders and fund development'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔄</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.economics?.circulation?.title || 'Token Circulation'}
                </h3>
                <p className="text-muted-foreground">
                  {t.economics?.circulation?.description || 'Dynamic supply based on platform activity and community participation'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🛡️</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-card-foreground">
                  {t.economics?.stability?.title || 'Price Stability'}
                </h3>
                <p className="text-muted-foreground">
                  {t.economics?.stability?.description || 'Pegged value through algorithmic stabilization and community governance'}
                </p>
              </div>
            </div>
          </div>

          {/* Getting Started with RING */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">
              {t.gettingStarted?.title || 'Getting Started with RING'}
            </h2>

            <Steps>
              <Step>
                <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {t.gettingStarted?.step1?.title || 'Create Account'}
                    </h3>
                    <p className="opacity-90">
                      {t.gettingStarted?.step1?.description || 'Sign up for a Ring Platform account using Google One Tap'}
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
                      {t.gettingStarted?.step2?.title || 'Get RING Tokens'}
                    </h3>
                    <p className="opacity-90">
                      {t.gettingStarted?.step2?.description || 'Purchase RING tokens through supported exchanges or earn through platform participation'}
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
                      {t.gettingStarted?.step3?.title || 'Start Using Platform'}
                    </h3>
                    <p className="opacity-90">
                      {t.gettingStarted?.step3?.description || 'Use RING tokens to access premium features and participate in the economy'}
                    </p>
                  </div>
                </div>
              </Step>
            </Steps>
          </div>

          {/* Call to Action */}
          <div className="text-center">
        <div className="bg-card rounded-2xl p-8 shadow-lg border">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {t.cta?.title || 'Participate in the RING Economy'}
              </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                {t.cta?.subtitle || 'Join the decentralized economy that rewards collaboration and innovation.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={`/${locale}/wallet`}
                  className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
                >
                  {t.cta?.getRing || 'Get RING Tokens'}
                </a>
                <a
                  href={`/${locale}/docs/token-economics`}
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
