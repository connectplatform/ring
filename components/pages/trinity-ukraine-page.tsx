'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Session } from 'next-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Users, Globe, Heart, Target, Sparkles, ArrowRight } from 'lucide-react'
import type { Locale } from '@/i18n-config'

interface TrinityUkrainePageProps {
  userAgent: string | null
  token: string | undefined
  params: any
  searchParams: any
  session: Session | null
  locale: Locale
}

const TrinityUkrainePage: React.FC<TrinityUkrainePageProps> = ({
  session,
  locale
}) => {
  const t = useTranslations('pages.trinityUkraine')
  const tCommon = useTranslations('common')

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  }

  const impactStats = [
    { icon: Globe, label: 'Global Deployments', value: '50+', color: 'text-blue-500' },
    { icon: Users, label: 'People Served', value: '10,000+', color: 'text-green-500' },
    { icon: Target, label: 'Countries Reached', value: '25+', color: 'text-purple-500' },
    { icon: Heart, label: 'Communities Empowered', value: '200+', color: 'text-red-500' }
  ]

  const teamMembers = [
    {
      name: 'Oleksandr',
      role: 'Lead Developer',
      specialty: 'AI Orchestration & Web3',
      image: '/images/team/oleksandr.jpg'
    },
    {
      name: 'Mykhailo',
      role: 'Platform Architect',
      specialty: 'System Design & Scaling',
      image: '/images/team/mykhailo.jpg'
    },
    {
      name: 'Andriy',
      role: 'UI/UX Designer',
      specialty: 'User Experience & Accessibility',
      image: '/images/team/andriy.jpg'
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Three-column layout for desktop - Trinity page spans feed + options columns */}
      <div className="grid grid-cols-[280px_1fr] gap-6 min-h-screen">
        {/* Left Sidebar - Navigation */}
        <div className="hidden lg:block">
          {/* We can add a minimal sidebar or leave it empty for now */}
        </div>

        {/* Main Content - Spans across feed and options columns */}
        <div className="lg:ml-0 lg:mr-0 mr-4 ml-4">
          {/* Hero Section */}
          <motion.section
            className="relative py-20 px-4 bg-gradient-to-br from-blue-50 via-white to-yellow-50 dark:from-blue-950/20 dark:via-background dark:to-yellow-950/20"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-6xl mx-auto text-center">
          <motion.div variants={itemVariants} className="mb-8">
            <div className="text-6xl mb-4">🇺🇦</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-yellow-600 bg-clip-text text-transparent">
              Trinity Ukraine
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="text-left">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  {t('mission')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('missionText')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-left">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  {t('philosophy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('philosophyText')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>

      {/* Origin Story */}
      <motion.section
        className="py-20 px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('originStory')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('originSubtitle')}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-8">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold">2022</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{t('beginning')}</h3>
                    <p className="text-muted-foreground">
                      {t('beginningText')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold">2023</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{t('building')}</h3>
                    <p className="text-muted-foreground">
                      {t('buildingText')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">2024</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{t('impact')}</h3>
                    <p className="text-muted-foreground">
                      {t('impactText')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>

      {/* Impact Dashboard */}
      <motion.section
        className="py-20 px-4 bg-muted/30"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('globalImpact')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('globalImpactSubtitle')}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {impactStats.map((stat, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <stat.icon className={`h-12 w-12 mx-auto mb-4 ${stat.color}`} />
                  <div className="text-3xl font-bold mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* World Map Placeholder */}
          <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-lg p-8 text-center">
            <Globe className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <h3 className="text-xl font-semibold mb-4">{t('worldMapTitle')}</h3>
            <p className="text-muted-foreground">
              {t('worldMapText')}
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Vision for the Future */}
      <motion.section
        className="py-20 px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={itemVariants} className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('futureVision')}</h2>
            <div className="text-6xl mb-6">🚀</div>
            <blockquote className="text-xl md:text-2xl italic text-muted-foreground border-l-4 border-primary pl-6 mb-8">
              {t('futureQuote')}
            </blockquote>
          </motion.div>

          <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  2025 Q2
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">
                  {t('roadmap2025q2')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  2025 Q3
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">
                  {t('roadmap2025q3')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  2026 Q1
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">
                  {t('roadmap2026q1')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>

      {/* Team Section */}
      <motion.section
        className="py-20 px-4 bg-muted/30"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('meetTeam')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('teamSubtitle')}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                  <Badge variant="secondary" className="mb-3">{member.role}</Badge>
                  <p className="text-sm text-muted-foreground">{member.specialty}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Call to Action */}
      <motion.section
        className="py-20 px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('joinMission')}</h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t('joinMissionText')}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href={`/${locale}/docs/getting-started`}>
                {t('cloneRing')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href={`/${locale}/opportunities?type=ring_customization`}>
                {t('findProjects')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>
        </div>

        {/* Right Sidebar - Empty for now */}
        <div className="hidden lg:block">
          {/* Can be used for additional content later */}
        </div>
      </div>

      {/* Mobile Layout - Stack vertically */}
      <div className="lg:hidden">
        <div className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <motion.section
            className="relative py-20 px-4 bg-gradient-to-br from-blue-50 via-white to-yellow-50 dark:from-blue-950/20 dark:via-background dark:to-yellow-950/20"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="max-w-6xl mx-auto text-center">
              <motion.div variants={itemVariants} className="mb-8">
                <div className="text-6xl mb-4">🇺🇦</div>
                <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-yellow-600 bg-clip-text text-transparent">
                  Trinity Ukraine
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                  {t('subtitle')}
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <Card className="text-left">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      {t('mission')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t('missionText')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      {t('philosophy')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t('philosophyText')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.section>

          {/* Origin Story */}
          <motion.section
            className="py-20 px-4"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="max-w-4xl mx-auto">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('originStory')}</h2>
                <p className="text-xl text-muted-foreground">
                  {t('originSubtitle')}
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-8">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold">2022</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{t('beginning')}</h3>
                        <p className="text-muted-foreground">
                          {t('beginningText')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-bold">2023</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{t('building')}</h3>
                        <p className="text-muted-foreground">
                          {t('buildingText')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 font-bold">2024</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{t('impact')}</h3>
                        <p className="text-muted-foreground">
                          {t('impactText')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.section>

          {/* Impact Dashboard */}
          <motion.section
            className="py-20 px-4 bg-muted/30"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="max-w-6xl mx-auto">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('globalImpact')}</h2>
                <p className="text-xl text-muted-foreground">
                  {t('globalImpactSubtitle')}
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {impactStats.map((stat, index) => (
                  <Card key={index} className="text-center">
                    <CardContent className="p-6">
                      <stat.icon className={`h-12 w-12 mx-auto mb-4 ${stat.color}`} />
                      <div className="text-3xl font-bold mb-2">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>

              {/* World Map Placeholder */}
              <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-lg p-8 text-center">
                <Globe className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-semibold mb-4">{t('worldMapTitle')}</h3>
                <p className="text-muted-foreground">
                  {t('worldMapText')}
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* Vision for the Future */}
          <motion.section
            className="py-20 px-4"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="max-w-4xl mx-auto text-center">
              <motion.div variants={itemVariants} className="mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('futureVision')}</h2>
                <div className="text-6xl mb-6">🚀</div>
                <blockquote className="text-xl md:text-2xl italic text-muted-foreground border-l-4 border-primary pl-6 mb-8">
                  {t('futureQuote')}
                </blockquote>
              </motion.div>

              <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      2025 Q2
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground">
                      {t('roadmap2025q2')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      2025 Q3
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground">
                      {t('roadmap2025q3')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      2026 Q1
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground">
                      {t('roadmap2026q1')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.section>

          {/* Team Section */}
          <motion.section
            className="py-20 px-4 bg-muted/30"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="max-w-6xl mx-auto">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('meetTeam')}</h2>
                <p className="text-xl text-muted-foreground">
                  {t('teamSubtitle')}
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-8">
                {teamMembers.map((member, index) => (
                  <Card key={index} className="text-center">
                    <CardContent className="p-6">
                      <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                      <Badge variant="secondary" className="mb-3">{member.role}</Badge>
                      <p className="text-sm text-muted-foreground">{member.specialty}</p>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* Call to Action */}
          <motion.section
            className="py-20 px-4"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="max-w-4xl mx-auto text-center">
              <motion.div variants={itemVariants} className="mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('joinMission')}</h2>
                <p className="text-xl text-muted-foreground mb-8">
                  {t('joinMissionText')}
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href={`/${locale}/docs/getting-started`}>
                    {t('cloneRing')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                  <Link href={`/${locale}/opportunities?type=ring_customization`}>
                    {t('findProjects')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

export default TrinityUkrainePage
