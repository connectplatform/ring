'use client'

import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, ShoppingCart, Zap, CreditCard, Webhook, Shield, Database } from 'lucide-react'

type Locale = 'en' | 'uk' | 'ru'

type StepCopy = { title: string; body: string }

const copy: Record<Locale, {
  title: string
  subtitle: string
  steps: [StepCopy, StepCopy, StepCopy, StepCopy, StepCopy]
  connectors: [string, string, string, string]
  loop: string
  footnotes: [string, string, string]
}> = {
  en: {
    title: 'How PaymentConductor works',
    subtitle: 'One checkout request flows through conductor → processor → webhook → handler → ledger.',
    steps: [
      { title: 'Checkout',      body: 'User initiates payment for store order, membership upgrade, or news promotion — one unified request flow.' },
      { title: 'Conductor',     body: 'PaymentConductor selects the gateway (WayForPay, Stripe, or internal credit) based on ring-config.json and purpose.' },
      { title: 'Gateway',       body: 'WayForPay hosted page, Stripe Checkout Sessions, or internal RING credit — all three rails share the contract.' },
      { title: 'Webhook',       body: 'Webhook dispatcher routes by purpose (store_order / membership_upgrade / news_promotion) to the correct handler.' },
      { title: 'Ledger',        body: 'Every payment is recorded in payment_transactions — SSOT ledger with idempotency, status tracking, and audit trail.' },
    ],
    connectors: ['routes to', 'redirects to', 'calls back to', 'writes to'],
    loop: 'Payment status flows back to the UI via transaction lookup',
    footnotes: ['One POST /api/payments/webhook handles all gateways.', 'Config-driven — swap gateways in ring-config.json.', 'Idempotent: duplicate webhooks are silently ignored.'],
  },
  uk: {
    title: 'Як працює PaymentConductor',
    subtitle: 'Один платіжний запит проходить через кондуктор → процесор → вебхук → обробник → книгу.',
    steps: [
      { title: 'Оплата',        body: 'Користувач ініціює платіж для замовлення, підвищення членства або просування новин — єдиний потік запитів.' },
      { title: 'Кондуктор',     body: 'PaymentConductor обирає шлюз (WayForPay, Stripe або внутрішній кредит) на основі ring-config.json і призначення.' },
      { title: 'Шлюз',          body: 'WayForPay (хостова сторінка), Stripe (Checkout Sessions) або внутрішній RING-кредит — три платіжні рейки за одним контрактом.' },
      { title: 'Вебхук',        body: 'Диспетчер вебхуків маршрутизує за призначенням (store_order / membership_upgrade / news_promotion) до потрібного обробника.' },
      { title: 'Книга',         body: 'Кожен платіж фіксується в payment_transactions — єдине джерело правди з ідемпотентністю, статусом та аудитом.' },
    ],
    connectors: ['спрямовує до', 'перенаправляє до', 'викликає', 'записує до'],
    loop: 'Статус платежу повертається в UI через пошук транзакції',
    footnotes: ['Один POST /api/payments/webhook обробляє всі шлюзи.', 'Керування через конфігурацію — змінюйте шлюзи в ring-config.json.', 'Ідемпотентність: дублікати вебхуків ігноруються.'],
  },
  ru: {
    title: 'Как работает PaymentConductor',
    subtitle: 'Один платёжный запрос проходит через кондуктор → процессор → вебхук → обработчик → книгу.',
    steps: [
      { title: 'Оплата',        body: 'Пользователь инициирует платёж для заказа, повышения членства или продвижения новостей — единый поток запросов.' },
      { title: 'Кондуктор',     body: 'PaymentConductor выбирает шлюз (WayForPay, Stripe или внутренний кредит) на основе ring-config.json и назначения.' },
      { title: 'Шлюз',          body: 'WayForPay (хостовая страница), Stripe (Checkout Sessions) или внутренний RING-кредит — три платёжных рельса по одному контракту.' },
      { title: 'Вебхук',        body: 'Диспетчер вебхуков маршрутизирует по назначению (store_order / membership_upgrade / news_promotion) к нужному обработчику.' },
      { title: 'Книга',         body: 'Каждый платёж фиксируется в payment_transactions — единый источник правды с идемпотентностью, статусом и аудитом.' },
    ],
    connectors: ['направляет к', 'перенаправляет к', 'вызывает', 'записывает в'],
    loop: 'Статус платежа возвращается в UI через поиск транзакции',
    footnotes: ['Один POST /api/payments/webhook обрабатывает все шлюзы.', 'Управление через конфигурацию — меняйте шлюзы в ring-config.json.', 'Идемпотентность: дубликаты вебхуков игнорируются.'],
  },
}

const stepMeta = [
  { icon: ShoppingCart, ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { icon: Zap,           ring: 'ring-amber-500/50',  bg: 'bg-amber-500/10',   iconColor: 'text-amber-600   dark:text-amber-400' },
  { icon: CreditCard,    ring: 'ring-indigo-500/50',  bg: 'bg-indigo-500/10',  iconColor: 'text-indigo-600  dark:text-indigo-400' },
  { icon: Webhook,       ring: 'ring-fuchsia-500/40', bg: 'bg-fuchsia-500/10', iconColor: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { icon: Database,      ring: 'ring-sky-500/40',     bg: 'bg-sky-500/10',     iconColor: 'text-sky-600     dark:text-sky-400' },
] as const

export interface RingPaymentConductorFlowProps {
  title?: string
  subtitle?: string
  locale?: Locale
}

function ProcessConnector({ label, reduced, vertical }: { label: string; reduced: boolean; vertical?: boolean }) {
  const Arrow = vertical ? ArrowDown : ArrowRight
  return (
    <div className={vertical ? 'flex flex-col items-center justify-center gap-1 py-1' : 'flex flex-col items-center justify-center gap-1 px-1 lg:min-w-[3rem]'} aria-hidden>
      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className={vertical ? 'relative h-6 w-0.5 overflow-hidden rounded-full bg-border' : 'relative h-0.5 w-full min-w-[2rem] max-w-[3rem] overflow-hidden rounded-full bg-border lg:min-w-[2.5rem]'}>
        {!reduced && (
          <motion.span className="absolute rounded-full bg-primary shadow-sm"
            style={vertical ? { left: '50%', width: 6, height: 6, marginLeft: -3 } : { top: '50%', width: 6, height: 6, marginTop: -3 }}
            animate={vertical ? { top: ['0%', '100%'] } : { left: ['0%', '100%'] }}
            transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }} />
        )}
      </div>
      <Arrow className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
    </div>
  )
}

function ReturnLoop({ label, reduced, uid }: { label: string; reduced: boolean; uid: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5 border-t border-border pt-4">
      <svg viewBox="0 0 320 36" className="h-8 w-full max-w-sm text-fuchsia-500/60" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-loop`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(236 72 153)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="rgb(236 72 153)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path d="M 280 8 C 200 8, 200 28, 120 28 C 60 28, 60 8, 40 8" fill="none" stroke={`url(#${uid}-loop)`} strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" opacity={reduced ? 0.5 : 1} />
        {!reduced && <circle r="3" fill="rgb(236 72 153)"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 280 8 C 200 8, 200 28, 120 28 C 60 28, 60 8, 40 8" /></circle>}
        <polygon points="36,8 44,8 40,3" fill="rgb(16 185 129)" opacity="0.7" />
      </svg>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ProcessStep({ step, index, reduced }: { step: StepCopy; index: number; reduced: boolean }) {
  const meta = stepMeta[index]
  const Icon = meta.icon
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className={`relative z-10 flex flex-1 flex-col rounded-lg border border-border bg-card p-3 shadow-sm ring-2 ${meta.ring} min-w-0`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.bg}`}>
          <Icon className={`h-4 w-4 ${meta.iconColor}`} aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step {index + 1}</p>
          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
    </motion.article>
  )
}

export function RingPaymentConductorFlow({ title, subtitle, locale = 'en' }: RingPaymentConductorFlowProps) {
  const t = copy[locale] ?? copy.en
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  return (
    <figure className="my-8 rounded-2xl border border-border bg-card shadow-sm">
      <figcaption className="border-b border-border px-5 py-4 md:px-6">
        <p className="text-lg font-semibold tracking-tight text-foreground">{title ?? t.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? t.subtitle}</p>
      </figcaption>
      <div className="px-3 py-5 md:px-5 md:py-6">
        <div className="hidden items-stretch lg:flex">
          {t.steps.map((step, i) => (
            <React.Fragment key={step.title}>
              <ProcessStep step={step} index={i} reduced={!!reduced} />
              {i < t.steps.length - 1 && <ProcessConnector label={t.connectors[i]} reduced={!!reduced} />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-col lg:hidden">
          {t.steps.map((step, i) => (
            <React.Fragment key={step.title}>
              <ProcessStep step={step} index={i} reduced={!!reduced} />
              {i < t.steps.length - 1 && <ProcessConnector label={t.connectors[i]} reduced={!!reduced} vertical />}
            </React.Fragment>
          ))}
        </div>
        <ReturnLoop label={t.loop} reduced={!!reduced} uid={uid} />
        <ul className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-3 md:gap-3">
          {t.footnotes.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
