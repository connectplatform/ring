'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/docs/callout';
import { Heart, Users, Globe, Code, Target, Sparkles, MapPin, Award, Github, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export function AboutTrinityClient() {
  const t = useTranslations('about-trinity');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 lg:ml-72 xl:ml-72">
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/10"></div>
        <div className="relative max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-center space-x-4 mb-8">
            <div className="text-6xl">🇺🇦</div>
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent">
                Trinity Ukraine
              </h1>
              <p className="text-xl text-muted-foreground mt-2">
                Creators of Ring Platform
              </p>
            </div>
          </div>

              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('hero.description')}
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Code className="w-4 h-4 mr-2" />
              {t('badges.openSource')}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              {t('badges.aiPowered')}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Globe className="w-4 h-4 mr-2" />
              {t('badges.weaponOfPeace')}
            </Badge>
          </div>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('sections.origin.title')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('sections.origin.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold flex items-center">
                  <MapPin className="w-6 h-6 mr-3 text-primary" />
                  {t('sections.origin.stories.crisis.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('sections.origin.stories.crisis.description')}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-semibold flex items-center">
                  <Target className="w-6 h-6 mr-3 text-primary" />
                  {t('sections.origin.stories.liberation.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('sections.origin.stories.liberation.description')}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-semibold flex items-center">
                  <Heart className="w-6 h-6 mr-3 text-red-500" />
                  {t('sections.origin.stories.gratitude.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('sections.origin.stories.gratitude.description')}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-muted to-muted dark:from-muted/50 dark:to-muted/50 rounded-2xl p-8 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="text-8xl">🌍</div>
                  <p className="text-lg font-medium">Technology for Everyone</p>
                  <p className="text-sm text-muted-foreground">
                    No developers required. No vendor lock-in. Just collective solutions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Philosophy */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('sections.mission.title')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('sections.mission.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6">
              <CardContent className="space-y-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{t('sections.mission.cards.unite.title')}</h3>
                <p className="text-muted-foreground">
                  {t('sections.mission.cards.unite.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="space-y-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{t('sections.mission.cards.democratize.title')}</h3>
                <p className="text-muted-foreground">
                  {t('sections.mission.cards.democratize.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="space-y-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{t('sections.mission.cards.endDeficit.title')}</h3>
                <p className="text-muted-foreground">
                  {t('sections.mission.cards.endDeficit.description')}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <Callout type="info">
              <strong>Our Vision:</strong> A future where platforms write their own code. Autonomous AI evolution guided by human needs,
              not corporate profits. Communities that govern themselves through token democracy, not centralized control.
            </Callout>
          </div>
        </div>
      </section>

      {/* Global Impact */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('sections.impact.title')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('sections.impact.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center p-6">
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">50+</div>
                <div className="text-sm text-muted-foreground">{t('sections.impact.stats.deployments')}</div>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">€500M+</div>
                <div className="text-sm text-muted-foreground">{t('sections.impact.stats.value')}</div>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">2.5M+</div>
                <div className="text-sm text-muted-foreground">{t('sections.impact.stats.benefiting')}</div>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 mb-2">40+</div>
                <div className="text-sm text-muted-foreground">{t('sections.impact.stats.countries')}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold">{t('sections.impact.stories.title')}</h3>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">{t('sections.impact.stories.agricultural.name')}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('sections.impact.stories.agricultural.description')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">{t('sections.impact.stories.marketplace.name')}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('sections.impact.stories.marketplace.description')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">{t('sections.impact.stories.medical.name')}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('sections.impact.stories.medical.description')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-semibold">{t('sections.impact.democratization.title')}</h3>

              <div className="space-y-4 text-muted-foreground">
                <p>
                  {t('sections.impact.democratization.description')}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-muted to-muted dark:from-muted/50 dark:to-muted/50 rounded-lg">
                <p className="text-sm italic">
                  "Ring doesn't just give communities technology - it gives them technological sovereignty.
                  The ability to evolve their platforms based on their own needs, not corporate roadmaps."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Vision */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">{t('sections.future.title')}</h2>

          <div className="space-y-8">
            <div className="max-w-2xl mx-auto">
              <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                {t('sections.future.description')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="text-center">
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold mb-2">AI Autonomous Evolution</h3>
                <p className="text-sm text-muted-foreground">
                  Platforms that write their own code based on natural language requirements
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl mb-4">🌐</div>
                <h3 className="text-lg font-semibold mb-2">Inter-Platform Learning</h3>
                <p className="text-sm text-muted-foreground">
                  Ring instances teaching other Ring instances, accelerating global evolution
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold mb-2">Real-time Adaptation</h3>
                <p className="text-sm text-muted-foreground">
                  Platforms that evolve in real-time based on user behavior and needs
                </p>
              </div>
            </div>

            <Callout type="success">
              <strong>This is our roadmap:</strong> From human-guided platforms to autonomous AI evolution.
              From centralized control to community governance. From technology deficit to technological abundance.
            </Callout>
          </div>
        </div>
      </section>

      {/* Team & Gratitude */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('thankYou.title')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('thankYou.subtitle')}
            </p>
          </div>

          <div className="text-center space-y-8">
            <div className="max-w-2xl mx-auto">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('thankYou.description')}
              </p>

            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
              <Button asChild size="lg">
                <Link href="/docs/library/white-label/quick-start">
                  <Github className="w-4 h-4 mr-2" />
                  {t('actions.cloneRing')}
                </Link>
              </Button>

              <Button variant="outline" size="lg" asChild>
                <Link href="/token-economy">
                  <Award className="w-4 h-4 mr-2" />
                  {t('actions.learnTokens')}
                </Link>
              </Button>

              <Button variant="outline" size="lg" asChild>
                <a href="https://github.com/connectplatform/ring-platform" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('actions.viewSource')}
                </a>
              </Button>
            </div>

            <div className="mt-16 p-8 bg-gradient-to-r from-muted to-muted dark:from-muted/50 dark:to-muted/50 rounded-2xl">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Heart className="w-6 h-6 text-red-500" />
                <span className="text-lg font-medium">{t('thankYou.slogan')}</span>
                <Heart className="w-6 h-6 text-red-500" />
              </div>

              <p className="text-muted-foreground">
                {t('thankYou.message')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
