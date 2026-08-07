'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  Building2,
  Globe2,
  Heart,
  Layers,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

export type WelcomeVizLocale = 'en' | 'uk' | 'ru'

function VizShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <figure className="my-8 w-full rounded-2xl border border-border bg-card shadow-sm">
      <figcaption className="border-b border-border px-5 py-4 md:px-6">
        <p className="text-lg font-semibold tracking-tight text-foreground">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </figcaption>
      <div className="w-full px-4 py-6 md:px-6 md:py-7">{children}</div>
    </figure>
  )
}

function GutterArrow({ reduced, vertical }: { reduced: boolean; vertical?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${
        vertical ? 'py-2' : 'px-1 lg:px-2'
      }`}
      aria-hidden
    >
      <ArrowRight className={`h-4 w-4 text-muted-foreground/70 ${vertical ? 'rotate-90' : ''}`} />
      {!reduced && (
        <motion.span
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-primary"
          animate={vertical ? { y: [-4, 4, -4] } : { x: [-4, 4, -4] }}
          transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

// —— 1. Collective intelligence flywheel ——

const flywheelCopy: Record<WelcomeVizLocale, { title: string; subtitle: string; nodes: string[]; loop: string }> = {
  en: {
    title: 'Network effect of collective intelligence',
    subtitle: 'Every successful match teaches the matcher — notifications improve for everyone.',
    nodes: ['Community use', 'AI learns', 'Better matches', 'More success', 'Richer signals'],
    loop: 'Smarter notifications back to every user',
  },
  uk: {
    title: 'Мережевий ефект колективного інтелекту',
    subtitle: 'Кожен успішний збіг навчає matcher — сповіщення покращуються для всіх.',
    nodes: ['Використання', 'AI вчиться', 'Кращі збіги', 'Більше успіху', 'Багатші сигнали'],
    loop: 'Розумніші сповіщення кожному користувачу',
  },
  ru: {
    title: 'Сетевой эффект коллективного интеллекта',
    subtitle: 'Каждое успешное совпадение обучает matcher — уведомления улучшаются для всех.',
    nodes: ['Использование', 'AI учится', 'Лучшие match', 'Больше успеха', 'Богаче сигналы'],
    loop: 'Умнее уведомления каждому пользователю',
  },
}

export function RingCollectiveIntelligenceLoop({ locale = 'en' }: { locale?: WelcomeVizLocale }) {
  const t = flywheelCopy[locale] ?? flywheelCopy.en
  const reduced = useReducedMotion()

  return (
    <VizShell title={t.title} subtitle={t.subtitle}>
      <div className="hidden w-full lg:block">
        <div className="flex w-full items-center justify-between gap-1">
          {t.nodes.map((label, i) => (
            <React.Fragment key={label}>
              <div
                className={`flex flex-1 flex-col items-center rounded-lg border px-2 py-3 text-center ${
                  i === 1 ? 'border-pink-500/40 bg-pink-500/10' : 'border-border bg-muted/30'
                }`}
              >
                <span className="text-[11px] font-medium leading-tight text-foreground">{label}</span>
              </div>
              {i < t.nodes.length - 1 ? <GutterArrow reduced={!!reduced} /> : null}
            </React.Fragment>
          ))}
        </div>
        <svg viewBox="0 0 600 36" className="mt-2 h-9 w-full text-primary/60" aria-hidden>
          <path
            d="M 560 8 C 300 8, 300 28, 40 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          {!reduced && (
            <circle r="3" fill="currentColor">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 560 8 C 300 8, 300 28, 40 28" />
            </circle>
          )}
          <polygon points="36,28 44,28 40,22" fill="currentColor" />
        </svg>
        <p className="text-center text-xs text-muted-foreground">{t.loop}</p>
      </div>
      <ol className="flex flex-col gap-2 lg:hidden">
        {t.nodes.map((label, i) => (
          <li key={label} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </VizShell>
  )
}

// —— 2. Deployment paths → ring-deployment-paths.tsx ——

// —— 3. Feature ecosystem ——

type Pillar = { title: string; items: string[] }

const ecosystemCopy: Record<WelcomeVizLocale, { title: string; pillars: Pillar[] }> = {
  en: {
    title: 'Ring Platform feature ecosystem',
    pillars: [
      { title: 'Core intelligence', items: ['AI opportunity matching', 'Advanced search & filters', 'Analytics & insights'] },
      { title: 'User experience', items: ['Auth.js v5 authentication', 'Real-time messaging', 'Push & in-app notifications'] },
      { title: 'Business platform', items: ['Organizations (26 industries)', 'Opportunities & applications', 'Multi-vendor store'] },
      { title: 'Finance & Web3', items: ['RING wallet & credits', 'WayForPay & crypto', 'NFT market & staking'] },
      { title: 'Infrastructure', items: ['React 19 · Next.js 16 · PostgreSQL', 'WebSocket / SSE transport', 'Docker · k8s · white-label'] },
    ],
  },
  uk: {
    title: 'Екосистема функцій Ring Platform',
    pillars: [
      { title: 'Ядро інтелекту', items: ['AI-підбір можливостей', 'Пошук і фільтри', 'Аналітика'] },
      { title: 'Досвід користувача', items: ['Auth.js v5', 'Месенджер у реальному часі', 'Push та in-app сповіщення'] },
      { title: 'Бізнес-платформа', items: ['Організації (26 галузей)', 'Можливості та заявки', 'Багатовендорний магазин'] },
      { title: 'Фінанси та Web3', items: ['Гаманець RING', 'WayForPay та крипто', 'NFT та стейкінг'] },
      { title: 'Інфраструктура', items: ['React 19 · Next.js 16 · PostgreSQL', 'WebSocket / SSE', 'Docker · k8s · white-label'] },
    ],
  },
  ru: {
    title: 'Экосистема функций Ring Platform',
    pillars: [
      { title: 'Ядро интеллекта', items: ['AI-подбор возможностей', 'Поиск и фильтры', 'Аналитика'] },
      { title: 'Опыт пользователя', items: ['Auth.js v5', 'Мессенджер в реальном времени', 'Push и in-app уведомления'] },
      { title: 'Бизнес-платформа', items: ['Организации (26 отраслей)', 'Возможности и заявки', 'Мульти-вендор магазин'] },
      { title: 'Финансы и Web3', items: ['Кошелёк RING', 'WayForPay и крипто', 'NFT и стейкинг'] },
      { title: 'Инфраструктура', items: ['React 19 · Next.js 16 · PostgreSQL', 'WebSocket / SSE', 'Docker · k8s · white-label'] },
    ],
  },
}

const pillarIcons = [Brain, MessageSquare, Building2, Zap, Layers]

export function RingFeatureEcosystem({ locale = 'en' }: { locale?: WelcomeVizLocale }) {
  const t = ecosystemCopy[locale] ?? ecosystemCopy.en

  return (
    <VizShell title={t.title}>
      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.pillars.map((pillar, i) => {
          const Icon = pillarIcons[i]
          const spanLast = i === t.pillars.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''
          return (
            <div key={pillar.title} className={`rounded-xl border border-border bg-muted/15 p-4 ${spanLast}`}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {pillar.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </VizShell>
  )
}

// —— 4. Problem-solving evolution ——

const evolutionCopy: Record<
  WelcomeVizLocale,
  { title: string; stages: Array<{ era: string; limit?: string; highlight?: boolean }> }
> = {
  en: {
    title: 'Evolution of problem-solving',
    stages: [
      { era: 'Individual intelligence', limit: 'One mind, one network' },
      { era: 'Organizational intelligence', limit: 'Siloed by company walls' },
      { era: 'Collective intelligence (Ring)', highlight: true },
      { era: 'Grand challenges solved', limit: 'Global collaboration at scale' },
    ],
  },
  uk: {
    title: 'Еволюція вирішення проблем',
    stages: [
      { era: 'Індивідуальний інтелект', limit: 'Один розум, одна мережа' },
      { era: 'Організаційний інтелект', limit: 'Силоси між компаніями' },
      { era: 'Колективний інтелект (Ring)', highlight: true },
      { era: 'Великі виклики вирішені', limit: 'Глобальна співпраця' },
    ],
  },
  ru: {
    title: 'Эволюция решения проблем',
    stages: [
      { era: 'Индивидуальный интеллект', limit: 'Один ум, одна сеть' },
      { era: 'Организационный интеллект', limit: 'Силосы между компаниями' },
      { era: 'Коллективный интеллект (Ring)', highlight: true },
      { era: 'Большие вызовы решены', limit: 'Глобальная коллаборация' },
    ],
  },
}

export function RingProblemSolvingEvolution({ locale = 'en' }: { locale?: WelcomeVizLocale }) {
  const t = evolutionCopy[locale] ?? evolutionCopy.en
  const reduced = useReducedMotion()

  return (
    <VizShell title={t.title}>
      <div className="hidden w-full items-stretch gap-2 md:flex">
        {t.stages.map((stage, i) => (
          <React.Fragment key={stage.era}>
            <div
              className={`flex flex-1 flex-col rounded-xl border p-3 ${
                stage.highlight
                  ? 'border-pink-500/40 bg-pink-500/10 ring-2 ring-pink-500/25'
                  : 'border-border bg-muted/20'
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{stage.era}</p>
              {stage.limit ? <p className="mt-1 text-xs text-muted-foreground">{stage.limit}</p> : null}
            </div>
            {i < t.stages.length - 1 ? <GutterArrow reduced={!!reduced} /> : null}
          </React.Fragment>
        ))}
      </div>
      <ol className="flex flex-col gap-2 md:hidden">
        {t.stages.map((stage, i) => (
          <li
            key={stage.era}
            className={`rounded-lg border px-3 py-2 text-sm ${stage.highlight ? 'border-pink-500/40 bg-pink-500/10' : 'border-border'}`}
          >
            <span className="font-medium">{i + 1}. {stage.era}</span>
            {stage.limit ? <span className="mt-0.5 block text-xs text-muted-foreground">{stage.limit}</span> : null}
          </li>
        ))}
      </ol>
    </VizShell>
  )
}

// —— 5. Humanity vision ——

const visionCopy: Record<
  WelcomeVizLocale,
  {
    title: string
    today: string
    hub: string
    branches: [string, string, string]
    tomorrow: string
    peace: string
  }
> = {
  en: {
    title: "Ring's vision for humanity",
    today: "Today's world — information scarcity",
    hub: 'Ring — AI orchestration',
    branches: ['Limitless opportunities', 'Serendipitous connections', 'Collective problem-solving'],
    tomorrow: "Tomorrow's world",
    peace: 'Abundance paths toward peace',
  },
  uk: {
    title: 'Бачення Ring для людства',
    today: 'Сьогодні — дефіцит інформації',
    hub: 'Ring — AI-оркестрація',
    branches: ['Безмежні можливості', 'Випадкові зв’язки', 'Колективні рішення'],
    tomorrow: 'Світ завтра',
    peace: 'Шлях достатку до миру',
  },
  ru: {
    title: 'Видение Ring для человечества',
    today: 'Сегодня — дефицит информации',
    hub: 'Ring — AI-оркестрация',
    branches: ['Безграничные возможности', 'Случайные связи', 'Коллективные решения'],
    tomorrow: 'Мир завтра',
    peace: 'Путь изобилия к миру',
  },
}

export function RingHumanityVision({ locale = 'en' }: { locale?: WelcomeVizLocale }) {
  const t = visionCopy[locale] ?? visionCopy.en
  const branchIcons = [TrendingUp, Users, Globe2]

  return (
    <VizShell title={t.title}>
      <div className="flex w-full flex-col items-center gap-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-muted/30 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
          {t.today}
        </div>
        <div className="flex h-8 items-center justify-center text-muted-foreground" aria-hidden>
          ↓
        </div>
        <div className="w-full max-w-sm rounded-xl border-2 border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-center text-sm font-semibold text-foreground ring-2 ring-indigo-500/20">
          <Sparkles className="mx-auto mb-1 h-4 w-4 text-indigo-500" aria-hidden />
          {t.hub}
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3">
          {t.branches.map((label, i) => {
            const Icon = branchIcons[i]
            return (
              <div key={label} className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs text-foreground">
                <Icon className="mx-auto mb-1 h-4 w-4 text-fuchsia-500" aria-hidden />
                {label}
              </div>
            )
          })}
        </div>
        <div className="flex h-8 items-center justify-center text-muted-foreground" aria-hidden>
          ↓
        </div>
        <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-foreground">
          {t.tomorrow}
        </div>
        <div className="flex h-6 items-center justify-center text-muted-foreground" aria-hidden>
          ↓
        </div>
        <div className="flex w-full max-w-md items-center justify-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/10 px-4 py-3 text-center text-sm font-semibold text-foreground">
          <Heart className="h-4 w-4 text-pink-500" aria-hidden />
          {t.peace}
        </div>
      </div>
    </VizShell>
  )
}
