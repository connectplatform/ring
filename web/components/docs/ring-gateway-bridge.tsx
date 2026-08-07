'use client'

import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, Bell, MessageSquare, Sparkles, Users } from 'lucide-react'

type Locale = 'en' | 'uk' | 'ru'

type StepCopy = {
  title: string
  body: string
}

const copy: Record<
  Locale,
  {
    title: string
    subtitle: string
    steps: [StepCopy, StepCopy, StepCopy]
    connectors: [string, string]
    loop: string
    footnotes: [string, string, string]
  }
> = {
  en: {
    title: 'How Ring works',
    subtitle: 'A simple loop: you emit intent, Ring matches in the background, the right person gets a DM.',
    steps: [
      {
        title: 'Emit',
        body: 'People and organizations express needs, skills, and intent — often invisible to each other.',
      },
      {
        title: 'Match',
        body: 'Ring orchestrates AI matching and scores fit across eight factors — continuously, without manual search.',
      },
      {
        title: 'Notify',
        body: 'A high-confidence match becomes a direct message: the possibility shows up where you already work.',
      },
    ],
    connectors: ['into Ring', 'to inbox'],
    loop: 'Possibility manifests back in the physical world',
    footnotes: [
      'No infinite scroll of dead listings.',
      'Matching runs 24/7 while you live your life.',
      'One tap to view, apply, or connect.',
    ],
  },
  uk: {
    title: 'Як працює Ring',
    subtitle: 'Простий цикл: ви передаєте намір, Ring підбирає у фоні, потрібна людина отримує DM.',
    steps: [
      {
        title: 'Сигнал',
        body: 'Люди та організації висловлюють потреби, навички та намір — часто невидимі один одному.',
      },
      {
        title: 'Підбір',
        body: 'Ring оркеструє AI-підбір і оцінює збіг за вісьмома факторами — безперервно, без ручного пошуку.',
      },
      {
        title: 'Сповіщення',
        body: 'Високий збіг стає особистим повідомленням: можливість з’являється там, де ви вже працюєте.',
      },
    ],
    connectors: ['у Ring', 'в інбокс'],
    loop: 'Можливість матеріалізується у фізичному світі',
    footnotes: [
      'Без нескінченного скролу мертвих оголошень.',
      'Підбір працює 24/7, поки ви живете своїм життям.',
      'Один дотик — переглянути, подати заявку або з’єднатися.',
    ],
  },
  ru: {
    title: 'Как работает Ring',
    subtitle: 'Простой цикл: вы передаёте намерение, Ring сопоставляет в фоне, нужный человек получает DM.',
    steps: [
      {
        title: 'Сигнал',
        body: 'Люди и организации выражают потребности, навыки и намерение — часто невидимые друг для друга.',
      },
      {
        title: 'Сопоставление',
        body: 'Ring оркестрирует AI-сопоставление по восьми факторам — непрерывно, без ручного поиска.',
      },
      {
        title: 'Уведомление',
        body: 'Высокий match становится личным сообщением: возможность появляется там, где вы уже работаете.',
      },
    ],
    connectors: ['в Ring', 'в инбокс'],
    loop: 'Возможность проявляется в физическом мире',
    footnotes: [
      'Без бесконечной ленты мёртвых объявлений.',
      'Сопоставление работает 24/7, пока вы живёте своей жизнью.',
      'Одно касание — просмотр, отклик или связь.',
    ],
  },
}

const stepMeta = [
  { icon: Users, ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { icon: Sparkles, ring: 'ring-indigo-500/50', bg: 'bg-indigo-500/10', iconColor: 'text-indigo-600 dark:text-indigo-400' },
  { icon: MessageSquare, ring: 'ring-fuchsia-500/40', bg: 'bg-fuchsia-500/10', iconColor: 'text-fuchsia-600 dark:text-fuchsia-400' },
] as const

export interface RingGatewayBridgeProps {
  title?: string
  subtitle?: string
  locale?: Locale
}

function ProcessConnector({
  label,
  reduced,
  vertical,
}: {
  label: string
  reduced: boolean
  vertical?: boolean
}) {
  const Arrow = vertical ? ArrowDown : ArrowRight

  return (
    <div
      className={
        vertical
          ? 'flex flex-col items-center justify-center gap-1 py-2'
          : 'flex flex-col items-center justify-center gap-1 px-2 lg:min-w-[4.5rem]'
      }
      aria-hidden
    >
      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div
        className={
          vertical
            ? 'relative h-10 w-0.5 overflow-hidden rounded-full bg-border'
            : 'relative h-0.5 w-full min-w-[2.5rem] max-w-[4rem] overflow-hidden rounded-full bg-border lg:min-w-[3.5rem]'
        }
      >
        {!reduced && (
          <motion.span
            className="absolute rounded-full bg-primary shadow-sm"
            style={
              vertical
                ? { left: '50%', width: 8, height: 8, marginLeft: -4 }
                : { top: '50%', width: 8, height: 8, marginTop: -4 }
            }
            animate={vertical ? { top: ['0%', '100%'] } : { left: ['0%', '100%'] }}
            transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          />
        )}
      </div>
      <Arrow className="h-4 w-4 shrink-0 text-muted-foreground/80" />
    </div>
  )
}

function ReturnLoop({ label, reduced, uid }: { label: string; reduced: boolean; uid: string }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2 border-t border-border pt-5">
      <svg
        viewBox="0 0 320 48"
        className="h-10 w-full max-w-sm text-fuchsia-500/70"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${uid}-loop`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(236 72 153)" stopOpacity="0.2" />
            <stop offset="50%" stopColor="rgb(236 72 153)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          d="M 280 10 C 200 10, 200 38, 120 38 C 60 38, 60 10, 40 10"
          fill="none"
          stroke={`url(#${uid}-loop)`}
          strokeWidth="1.5"
          strokeDasharray="5 6"
          strokeLinecap="round"
          opacity={reduced ? 0.6 : 1}
        />
        {!reduced && (
          <circle r="3.5" fill="rgb(236 72 153)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 280 10 C 200 10, 200 38, 120 38 C 60 38, 60 10, 40 10" />
          </circle>
        )}
        <polygon points="36,10 44,10 40,4" fill="rgb(16 185 129)" opacity="0.8" />
      </svg>
      <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" aria-hidden />
        {label}
      </p>
    </div>
  )
}

function ProcessStep({
  step,
  index,
  reduced,
}: {
  step: StepCopy
  index: number
  reduced: boolean
}) {
  const meta = stepMeta[index]
  const Icon = meta.icon

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`relative z-10 flex flex-1 flex-col rounded-xl border border-border bg-card p-4 shadow-sm ring-2 ${meta.ring}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}
        >
          <Icon className={`h-5 w-5 ${meta.iconColor}`} aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step {index + 1}
          </p>
          <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
    </motion.article>
  )
}

export function RingGatewayBridge({ title, subtitle, locale = 'en' }: RingGatewayBridgeProps) {
  const t = copy[locale] ?? copy.en
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  return (
    <figure className="my-8 rounded-2xl border border-border bg-card shadow-sm">
      <figcaption className="border-b border-border px-5 py-4 md:px-6">
        <p className="text-lg font-semibold tracking-tight text-foreground">{title ?? t.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? t.subtitle}</p>
      </figcaption>

      <div className="px-4 py-6 md:px-6 md:py-7">
        {/* Desktop: row with gutters. Mobile: stack. */}
        <div className="hidden items-stretch lg:flex">
          <ProcessStep step={t.steps[0]} index={0} reduced={!!reduced} />
          <ProcessConnector label={t.connectors[0]} reduced={!!reduced} />
          <ProcessStep step={t.steps[1]} index={1} reduced={!!reduced} />
          <ProcessConnector label={t.connectors[1]} reduced={!!reduced} />
          <ProcessStep step={t.steps[2]} index={2} reduced={!!reduced} />
        </div>

        <div className="flex flex-col lg:hidden">
          {t.steps.map((step, i) => (
            <React.Fragment key={step.title}>
              <ProcessStep step={step} index={i} reduced={!!reduced} />
              {i < t.steps.length - 1 && (
                <ProcessConnector label={t.connectors[i]} reduced={!!reduced} vertical />
              )}
            </React.Fragment>
          ))}
        </div>

        <ReturnLoop label={t.loop} reduced={!!reduced} uid={uid} />

        <ul className="mt-5 grid gap-2 text-sm text-muted-foreground md:grid-cols-3 md:gap-4">
          {t.footnotes.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
