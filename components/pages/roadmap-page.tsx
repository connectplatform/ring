'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import type { TimelineItemModel } from 'react-chrono'
import {
  ArrowRight,
  BookOpen,
  Coins,
  Github,
  Image as ImageIcon,
  Map,
  Newspaper,
  Rocket,
  Sparkles,
  Terminal,
  Wallet,
} from 'lucide-react'
import { Callout } from '@/components/docs/callout'
import { CodeSandbox } from '@/components/docs/code-sandbox'
import { Math } from '@/components/docs/math'
import { Mermaid } from '@/components/docs/mermaid'
import { Timeline } from '@/components/docs/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VISUALIZATION_ROADMAP } from '@/lib/roadmap/visualization-roadmap'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

type DocLink = { title: string; description: string; href: string }
type ShippedItem = { name: string; tag: string }

const DOC_LINK_ICONS = [BookOpen, Newspaper, ImageIcon, Terminal, Rocket, Coins] as const

export function RoadmapPage() {
  const t = useTranslations('roadmap')
  const locale = useLocale()
  const spec = VISUALIZATION_ROADMAP

  const timelineItems = t.raw('timelineItems') as TimelineItemModel[]
  const shippedItems = t.raw('shipped.items') as ShippedItem[]
  const docLinks = t.raw('docs.links') as DocLink[]
  const platformPhases = [0, 1, 2].map((index) => ({
    title: t(`platform.phases.${index}.title`),
    timeline: t(`platform.phases.${index}.timeline`),
    body: t(`platform.phases.${index}.body`),
  }))

  const sandboxCode = String(t.raw('demos.sandboxCode')).replace(/\\n/g, '\n')
  const mathFormula = String(t.raw('demos.mathFormula'))

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <section className="relative py-16 px-4 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <Badge variant="outline" className="px-3 py-1">
            <Map className="h-3.5 w-3.5 mr-1.5 inline" />
            {t('hero.badge')}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">{t('hero.subtitle')}</p>
          <Callout type="info" title={t('hero.mandate')}>
            {spec.roadmap_name} · {t('labels.version', { version: spec.version })}
          </Callout>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href={`/${locale}/token-economy`}>
                <Coins className="h-4 w-4 mr-2" />
                {t('hero.ringCta')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={`/${locale}/wallet`}>
                <Wallet className="h-4 w-4 mr-2" />
                {t('hero.walletCta')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com/connectplatform/ring" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                {t('hero.cloneCta')}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <motion.section
        className="py-16 px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">{t('timeline.title')}</h2>
            <p className="text-muted-foreground">{t('timeline.subtitle')}</p>
          </div>
          <Timeline items={timelineItems} mode="VERTICAL_ALTERNATING" />
        </div>
      </motion.section>

      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">{t('shipped.title')}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t('shipped.subtitle')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {shippedItems.map((item) => (
              <Badge key={item.name} variant="secondary" className="px-3 py-1.5 text-sm">
                <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
                {item.name}
                <span className="ml-2 text-muted-foreground font-normal">{item.tag}</span>
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">{t('demos.title')}</h2>
            <p className="text-muted-foreground">{t('demos.subtitle')}</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('demos.mathCaption')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Math display>{mathFormula}</Math>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('demos.sandboxTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-0">
                <CodeSandbox code={sandboxCode} template="vanilla-ts" showPreview={false} />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <motion.section
        className="py-16 px-4 bg-muted/20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-3">{t('platform.title')}</h2>
            <p className="text-muted-foreground">{t('platform.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {platformPhases.map((phase, index) => (
              <motion.div key={phase.title} variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xl">{phase.title}</CardTitle>
                      <Badge variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}>
                        {phase.timeline}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">{phase.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">{t('docs.title')}</h2>
            <p className="text-muted-foreground">{t('docs.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docLinks.map((link, index) => {
              const Icon = DOC_LINK_ICONS[index % DOC_LINK_ICONS.length]
              return (
                <Link key={link.href} href={`/${locale}${link.href}`} className="group block h-full">
                  <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        {link.title}
                        <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardTitle>
                      <CardDescription className="text-sm">{link.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Mermaid title="Platform + docs evolution">
            {`flowchart TB
  subgraph today [Shipped]
    Newsroom[Autonomous Newsroom]
    MCP[Ring MCP 57 tools]
    Stack[Next.js 16 / React 19]
  end
  subgraph next [In development]
    Reggie[Reggie ringization]
    Connect[ConnectPlatform paths]
  end
  subgraph horizon [Horizon]
    Intent[NL module assembly]
    DAO[DAO governance]
  end
  today --> next --> horizon`}
          </Mermaid>
        </div>
      </section>

      <section className="py-12 px-4 border-t">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <Button asChild size="lg">
            <Link href={`/${locale}/docs`}>
              <BookOpen className="h-4 w-4 mr-2" />
              {t('visualization.exploreDocs')}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
