import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildMessages } from '@/lib/i18n'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import RingLogoWithFlag from '@/components/common/widgets/ring-logo-with-flag'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const messages = await buildMessages(locale);
  const t = messages['globalImpact'] || {};

  return {
    title: t.title || 'Global Impact - Ring Platform',
    description: t.description || 'Discover how Ring Platform creates global impact through AI-powered collective problem solving',
    keywords: ['Ring Platform', 'Global Impact', 'Digital Cities', 'Collective Intelligence', 'Trinity Ukraine', 'Open Source', 'AI', 'Web3'],
  }
}

export default async function GlobalImpactPage({ params }: Props) {
  const { locale: localeParam } = await params;
  const locale = localeParam as 'en' | 'uk' | 'ru';

  if (!['en', 'uk', 'ru'].includes(localeParam)) {
    notFound()
  }

  const messages = await buildMessages(locale);
  const t = messages['global-impact'] || {};

  return (
    <AboutWrapper locale={locale}>
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
          {t.hero?.subtitle || 'Ring Platform connects communities worldwide, enabling collaborative solutions to global challenges through AI-powered matching and transparent governance.'}
            </p>
          </div>

      {/* Logo Section */}
      <div className="flex justify-center mb-16">
                <RingLogoWithFlag />
              </div>

      {/* Impact Areas */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🌍</span>
          </div>
          <h3 className="text-2xl font-bold mb-4 text-card-foreground">
            {t.impact?.global?.title || 'Global Reach'}
                </h3>
          <p className="text-muted-foreground leading-relaxed">
            {t.impact?.global?.description || 'Connecting communities across continents to share knowledge, resources, and opportunities.'}
                </p>
              </div>

        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🤝</span>
                </div>
          <h3 className="text-2xl font-bold mb-4 text-card-foreground">
            {t.impact?.collaboration?.title || 'Collaboration'}
                </h3>
          <p className="text-muted-foreground leading-relaxed">
            {t.impact?.collaboration?.description || 'Enabling seamless collaboration between individuals, organizations, and communities.'}
                </p>
              </div>

        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🚀</span>
          </div>
          <h3 className="text-2xl font-bold mb-4 text-card-foreground">
            {t.impact?.innovation?.title || 'Innovation'}
                    </h3>
          <p className="text-muted-foreground leading-relaxed">
            {t.impact?.innovation?.description || 'Fostering innovation through AI-powered matching of problems with solutions.'}
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border border-border">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
          {t.stats?.title || 'Our Growing Impact'}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">50+</div>
            <div className="text-sm font-medium text-card-foreground">
              {t.stats?.countries?.label || 'Countries'}
            </div>
          </div>

          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">10K+</div>
            <div className="text-sm font-medium text-card-foreground">
              {t.stats?.users?.label || 'Active Users'}
            </div>
          </div>

          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">500+</div>
            <div className="text-sm font-medium text-card-foreground">
              {t.stats?.projects?.label || 'Projects'}
            </div>
          </div>

          <div className="text-center p-6 rounded-xl bg-muted/30 border">
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">100+</div>
            <div className="text-sm font-medium text-card-foreground">
              {t.stats?.communities?.label || 'Communities'}
            </div>
          </div>
        </div>
      </div>

      {/* Trinity Ukraine Initiative */}
      <div className="bg-gradient-to-r from-blue-600 to-yellow-500 rounded-2xl p-8 text-white mb-16">
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-4xl">🇺🇦</span>
          <h2 className="text-3xl font-bold">
            {t.trinity?.title || 'Trinity Ukraine Initiative'}
          </h2>
        </div>

        <p className="text-center text-lg opacity-90 max-w-3xl mx-auto mb-8">
          {t.trinity?.description || 'A special initiative supporting Ukrainian communities through technology, education, and economic opportunities during challenging times.'}
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-xl p-6 text-center">
            <div className="text-2xl mb-3">📚</div>
            <h3 className="font-semibold mb-2">
              {t.trinity?.education?.title || 'Education'}
            </h3>
            <p className="text-sm opacity-80">
              {t.trinity?.education?.description || 'Free tech education for displaced Ukrainians'}
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-6 text-center">
            <div className="text-2xl mb-3">💼</div>
            <h3 className="font-semibold mb-2">
              {t.trinity?.jobs?.title || 'Job Opportunities'}
            </h3>
            <p className="text-sm opacity-80">
              {t.trinity?.jobs?.description || 'Connecting talent with global opportunities'}
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-6 text-center">
            <div className="text-2xl mb-3">🏘️</div>
            <h3 className="font-semibold mb-2">
              {t.trinity?.community?.title || 'Community Building'}
            </h3>
            <p className="text-sm opacity-80">
              {t.trinity?.community?.description || 'Building digital Gromada communities'}
            </p>
          </div>
        </div>
            </div>

      {/* How You Can Help */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
          {t.help?.title || 'How You Can Contribute'}
          </h2>

          <Steps>
            <Step>
              <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">1</span>
                </div>
                <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.help?.step1?.title || 'Join the Platform'}
                  </h3>
                <p className="text-muted-foreground">
                  {t.help?.step1?.description || 'Create an account and become part of the global Ring community.'}
                  </p>
                </div>
              </div>
            </Step>

            <Step>
              <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">2</span>
                </div>
                <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.help?.step2?.title || 'Share Your Skills'}
                  </h3>
                <p className="text-muted-foreground">
                  {t.help?.step2?.description || 'Offer your expertise to help communities solve their challenges.'}
                  </p>
                </div>
              </div>
            </Step>

            <Step>
              <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">3</span>
                </div>
                <div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.help?.step3?.title || 'Support Projects'}
                  </h3>
                <p className="text-muted-foreground">
                  {t.help?.step3?.description || 'Contribute to meaningful projects and initiatives that create real-world impact.'}
                  </p>
                </div>
              </div>
            </Step>
          </Steps>
        </div>

        {/* Call to Action */}
      <div className="text-center">
        <div className="bg-card rounded-2xl p-8 shadow-lg border">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            {t.cta?.title || 'Make a Difference Today'}
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            {t.cta?.subtitle || 'Join thousands of people working together to create positive change around the world.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/${locale}/`}
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-green-700 transition-colors"
            >
              {t.cta?.getStarted || 'Get Started'}
            </a>
            <a
              href={`/${locale}/about`}
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
