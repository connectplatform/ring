'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import type { TimelineItem } from 'react-chrono'
import {
  ArrowRight,
  BookOpen,
  Coins,
  Image as ImageIcon,
  Map,
  Newspaper,
  Rocket,
  Sparkles,
  Terminal,
  Wallet,
} from 'lucide-react'
import { GithubIcon } from '@/components/ui/icons/github-icon'
import { Callout } from '@/components/docs/callout'
import { CodeSandbox } from '@/components/docs/code-sandbox'
import { Math } from '@/components/docs/math'
import { Mermaid } from '@/components/docs/mermaid'
import { Timeline } from '@/components/docs/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { VISUALIZATION_ROADMAP } from '@/lib/roadmap/visualization-roadmap'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

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

  const timelineItems = t.raw('timelineItems') as TimelineItem[]
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
    <div className="w-full min-w-0">
      {/* Hero — full-bleed beam tint */}
      <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
          aria-hidden
        />
        <div className={cn('relative mx-auto max-w-5xl space-y-6', INSET)}>
          <div className="flex justify-center">
            <DavinciGlassChip icon={<Map className="h-3 w-3" />}>{t('hero.badge')}</DavinciGlassChip>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{t('title')}</h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">{t('hero.subtitle')}</p>
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
                <GithubIcon className="h-4 w-4 mr-2" />
                {t('hero.cloneCta')}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <motion.section
        className={cn(BAND_Y, INSET)}
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

      {/* Shipped — full-bleed band */}
      <section
        className={cn(BAND_Y, 'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]')}
      >
        <div className={cn('max-w-6xl mx-auto', INSET)}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">{t('shipped.title')}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t('shipped.subtitle')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {shippedItems.map((item) => (
              <DavinciGlassChip key={item.name} icon={<Sparkles className="h-3 w-3" />}>
                {item.name}
                <span className="ml-1 font-normal text-muted-foreground">{item.tag}</span>
              </DavinciGlassChip>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(BAND_Y, INSET)}>
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">{t('demos.title')}</h2>
            <p className="text-muted-foreground">{t('demos.subtitle')}</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 sm:p-5')}>
              <h3 className="mb-3 text-lg font-semibold">{t('demos.mathCaption')}</h3>
              <Math display>{mathFormula}</Math>
            </div>
            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 sm:p-5')}>
              <h3 className="mb-3 text-lg font-semibold">{t('demos.sandboxTitle')}</h3>
              <CodeSandbox code={sandboxCode} template="vanilla-ts" showPreview={false} />
            </div>
          </div>
        </div>
      </section>

      <motion.section
        className={cn(BAND_Y, INSET, 'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]')}
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
          <div className="grid md:grid-cols-3 gap-4">
            {platformPhases.map((phase, index) => (
              <motion.div
                key={phase.title}
                variants={itemVariants}
                className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-semibold">{phase.title}</h3>
                  <Badge variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}>
                    {phase.timeline}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{phase.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <section className={cn(BAND_Y, INSET)}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">{t('docs.title')}</h2>
            <p className="text-muted-foreground">{t('docs.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docLinks.map((link, index) => {
              const Icon = DOC_LINK_ICONS[index % DOC_LINK_ICONS.length]
              return (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={cn(davinciGlassSurface, 'group block p-4')}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
                    <span className="text-base font-semibold">{link.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className={cn(BAND_Y, 'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]')}>
        <div className={cn('max-w-4xl mx-auto', INSET)}>
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

      <section className={cn(BAND_Y, INSET, 'border-t border-[var(--davinci-glass-border)]')}>
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
