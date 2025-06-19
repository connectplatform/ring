'use client'

import React from 'react'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Leaf, Coins, Globe, Users, Zap } from 'lucide-react'

const AgroLandingPage = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session } = useSession()

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          loop
          muted
          className="absolute w-full h-full object-cover"
        >
          <source src="/videos/agro-background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-6xl font-bold text-white mb-4"
          >
            {t('agro.hero.title')}
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            transition={{ delay: 0.2 }}
            className="text-xl text-white mb-8"
          >
            {t('agro.hero.subtitle')}
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            transition={{ delay: 0.4 }}
          >
            <Button size="lg" asChild>
              <Link href="#mission">
                {t('agro.hero.cta')} <ArrowRight className="ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Mission Statement */}
      <section id="mission" className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-4xl font-bold mb-6">{t('agro.mission.title')}</h2>
              <p className="text-lg mb-4">{t('agro.mission.description')}</p>
              <p className="text-lg mb-6">{t('agro.mission.details')}</p>
              <Button asChild>
                <a href="https://agroglorytime.io/" target="_blank" rel="noopener noreferrer">
                  {t('agro.mission.learnMore')}
                </a>
              </Button>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <Image
                src="/images/agro-mission.jpg"
                alt="agroGloryTime Mission"
                width={600}
                height={400}
                className="rounded-lg shadow-lg"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Goals Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">{t('agro.goals.title')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {['land', 'network', 'token', 'income'].map((goal, index) => (
              <motion.div
                key={goal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      {goal === 'land' && <Leaf className="mr-2" />}
                      {goal === 'network' && <Globe className="mr-2" />}
                      {goal === 'token' && <Coins className="mr-2" />}
                      {goal === 'income' && <Users className="mr-2" />}
                      {t(`agro.goals.${goal}.title`)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{t(`agro.goals.${goal}.description`)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment opportunities */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">{t('agro.investment.title')}</h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-lg text-center mb-12 max-w-3xl mx-auto"
          >
            {t('agro.investment.description')}
          </motion.p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {['location', 'technology', 'returns', 'trust', 'income'].map((benefit, index) => (
              <motion.div
                key={benefit}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{t(`agro.investment.benefits.${benefit}.title`)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{t(`agro.investment.benefits.${benefit}.description`)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Token Information */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">{t('agro.token.title')}</h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <p className="text-lg mb-6">{t('agro.token.description')}</p>
              <Button asChild size="lg">
                <a href="https://agroglorytime.io/" target="_blank" rel="noopener noreferrer">
                  {t('agro.token.buyTokens')}
                </a>
              </Button>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <Card>
                <CardHeader>
                  <CardTitle>{t('agro.token.earnings.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Zap className="mr-2" />
                      {t('agro.token.earnings.staking')}
                    </li>
                    <li className="flex items-center">
                      <Users className="mr-2" />
                      {t('agro.token.earnings.referral')}
                    </li>
                    <li className="flex items-center">
                      <ArrowRight className="mr-2" />
                      {t('agro.token.earnings.growth')}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Telegram and Support Links */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">{t('agro.community.title')}</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {['english', 'ukrainian', 'support'].map((link, index) => (
              <motion.div
                key={link}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: index * 0.1 }}
              >
                <Button asChild variant="outline" size="lg">
                  <a href={t(`agro.community.links.${link}.url`)} target="_blank" rel="noopener noreferrer">
                    {t(`agro.community.links.${link}.text`)}
                  </a>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">{t('agro.statistics.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {['fields', 'facilities', 'pastures', 'ponds', 'crops'].map((stat, index) => (
              <motion.div
                key={stat}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <h3 className="text-3xl font-bold mb-2">{t(`agro.statistics.${stat}.value`)}</h3>
                <p className="text-muted-foreground">{t(`agro.statistics.${stat}.label`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">{t('agro.cta.title')}</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">{t('agro.cta.description')}</p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/opportunities">
              {t('agro.cta.button')} <ArrowRight className="ml-2" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

export default AgroLandingPage

