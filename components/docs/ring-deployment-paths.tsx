'use client'

import React, { useCallback, useState } from 'react'
import { Check, Clock, Copy, Rocket, Sparkles, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RingLegioxSettlementChatPreview } from '@/components/docs/ring-legiox-settlement-chat'
import { BorderBeam, DavinciCtaLink, davinciBeamInnerSurface } from '@/lib/ui/davinci'

export type DeploymentLocale = 'en' | 'uk' | 'ru'

type PathTone = 'emerald' | 'indigo' | 'amber'

type PathNote = {
  variant: 'development' | 'success' | 'info'
  title: string
  body: string
}

type RouteStep =
  | { kind: 'text'; text: string }
  | { kind: 'command'; lead: string; command: string }
  | { kind: 'url'; lead: string; href: string }

type DeployPath = {
  id: string
  name: string
  time: string
  audience: string
  tone: PathTone
  route: RouteStep[]
  includes?: string[]
  note?: PathNote
  docLink?: { href: string; label: string }
  settlementPreview?: boolean
  ringdomBlurb?: string
  ringdomCta?: { href: string; label: string }
}

type LocaleCopy = {
  tablistLabel: string
  routeLabel: string
  includesLabel: string
  copyLabel: string
  copiedLabel: string
  paths: [DeployPath, DeployPath, DeployPath]
}

const copy: Record<DeploymentLocale, LocaleCopy> = {
  en: {
    tablistLabel: 'Deployment paths',
    routeLabel: 'Route',
    includesLabel: 'You get',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    paths: [
      {
        id: 'self-deploy',
        name: 'Instant self-deploy',
        time: '~5 minutes quick start',
        audience:
          'Developers cloning the community edition. Full PostgreSQL-primary setup is typically 45–90 minutes — see the installation guide.',
        tone: 'emerald',
        route: [
          {
            kind: 'command',
            lead: 'Clone the open-source Ring repo:',
            command: 'git clone https://github.com/connectplatform/ring.git\ncd ring',
          },
          {
            kind: 'command',
            lead: 'Run the installer (recommended — scaffolds ring-config.json, .env.local, secrets):',
            command: 'chmod +x install.sh\n./install.sh --quick',
          },
          {
            kind: 'text',
            text: 'Finish required .env.local values — DATABASE_URL (PostgreSQL k8s-postgres-fcm), AUTH_SECRET, and at least one OAuth provider.',
          },
          {
            kind: 'command',
            lead: 'Start the unified custom dev server (Next.js + WebSocket tunnel):',
            command: 'npm run dev',
          },
          {
            kind: 'url',
            lead: 'Open your local Ring instance:',
            href: 'http://localhost:3000',
          },
        ],
        includes: [
          'All 20+ modules, PostgreSQL-primary, Auth.js v5',
          'React 19 + Next.js 16 + install.sh scaffolding',
          'Default branding — customize anytime',
          'Zero licensing cost, forever',
        ],
        docLink: { href: '/docs/getting-started/installation', label: 'Full installation guide' },
      },
      {
        id: 'legiox',
        name: 'LegioX.pro customization',
        time: '10–30 minutes',
        audience:
          'Non-developers describe their Ring vision in conversational LegioX chat on legiox.pro — production hosting ships on Ringdom, managed Ring SaaS on ringdom.org.',
        tone: 'indigo',
        settlementPreview: true,
        ringdomBlurb:
          'Ringdom is managed Ring hosting SaaS: LegioX-guided ringization, Kubernetes operations, and ongoing settlement support — the turn-key path when you want outcomes instead of DIY ops.',
        ringdomCta: { href: 'https://ringdom.org/en/settler', label: 'Start on Ringdom' },
        route: [
          { kind: 'text', text: 'Open the settlement chat on LegioX.pro (same experience on Ringdom)' },
          { kind: 'text', text: 'Describe your community, product, or organization — attach notes, images, or audio' },
          { kind: 'text', text: 'Reggie and LegioX agents enable modules, branding, and integrations from your brief' },
          { kind: 'text', text: 'Iterate in chat until your Ring clone matches the vision — deploy on Ringdom or export' },
        ],
        note: {
          variant: 'development',
          title: 'Coming Q1 2026',
          body: 'Full conversational customization ships on LegioX.pro. Until then, start on Ringdom for expert-led ringization today.',
        },
        docLink: { href: 'https://legiox.pro', label: 'LegioX.pro' },
      },
      {
        id: 'promptor',
        name: 'Promptor service',
        time: '1–4 weeks',
        audience: 'Organizations that need production-ready Ring with expert partnership.',
        tone: 'amber',
        route: [
          { kind: 'text', text: 'Week 1 — Discovery: use case, requirements, architecture, scope' },
          { kind: 'text', text: 'Weeks 2–3 — Customization: branding, features, DB extensions, integrations, hardening' },
          { kind: 'text', text: 'Week 4 — Delivery: production deploy, team training, docs, handoff' },
          { kind: 'text', text: 'Ongoing — Promptor orchestrates Legiox AI with unlimited refinement iterations' },
        ],
        includes: [
          'Certified human expert + Legiox AI orchestration',
          'Knowledge transfer so you can command Legiox yourself',
          'Production deployment with security and performance tuning',
        ],
        note: {
          variant: 'success',
          title: 'Громада Academy',
          body: 'Want to become a Promptor? Certification through Громада Academy gameplay — launching 2026.',
        },
      },
    ],
  },
  uk: {
    tablistLabel: 'Шляхи розгортання',
    routeLabel: 'Маршрут',
    includesLabel: 'Ви отримуєте',
    copyLabel: 'Копіювати',
    copiedLabel: 'Скопійовано',
    paths: [
      {
        id: 'self-deploy',
        name: 'Миттєве self-deploy',
        time: '~5 хв швидкий старт',
        audience:
          'Розробники, що клонують community edition. Повне PostgreSQL-primary налаштування зазвичай 45–90 хв — див. посібник з установки.',
        tone: 'emerald',
        route: [
          {
            kind: 'command',
            lead: 'Клонуйте open-source репозиторій Ring:',
            command: 'git clone https://github.com/connectplatform/ring.git\ncd ring',
          },
          {
            kind: 'command',
            lead: 'Запустіть інсталятор (рекомендовано — ring-config.json, .env.local, секрети):',
            command: 'chmod +x install.sh\n./install.sh --quick',
          },
          {
            kind: 'text',
            text: 'Заповніть обов’язкові значення в .env.local — DATABASE_URL (PostgreSQL k8s-postgres-fcm), AUTH_SECRET і щонайменше один OAuth-провайдер.',
          },
          {
            kind: 'command',
            lead: 'Стартуйте єдиний dev-сервер (Next.js + WebSocket tunnel):',
            command: 'npm run dev',
          },
          {
            kind: 'url',
            lead: 'Відкрийте локальний екземпляр Ring:',
            href: 'http://localhost:3000',
          },
        ],
        includes: [
          'Усі 20+ модулів, PostgreSQL-primary, Auth.js v5',
          'React 19 + Next.js 16 + install.sh',
          'Стандартний брендинг — налаштуйте будь-коли',
          'Нульова вартість ліцензії назавжди',
        ],
        docLink: { href: '/docs/getting-started/installation', label: 'Повний посібник з установки' },
      },
      {
        id: 'legiox',
        name: 'Налаштування LegioX.pro',
        time: '10–30 хвилин',
        audience:
          'Не-розробники описують бачення Ring у розмовному чаті LegioX.pro — production-хостинг на Ringdom, managed Ring SaaS на ringdom.org.',
        tone: 'indigo',
        settlementPreview: true,
        ringdomBlurb:
          'Ringdom — managed Ring hosting SaaS: ringization під керівництвом LegioX, Kubernetes-операції та супровід поселення — turn-key шлях, коли потрібен результат, а не археологія репозиторію.',
        ringdomCta: { href: 'https://ringdom.org/en/settler', label: 'Start on Ringdom' },
        route: [
          { kind: 'text', text: 'Відкрийте settlement chat на LegioX.pro (той самий досвід на Ringdom)' },
          { kind: 'text', text: 'Опишіть спільноту, продукт чи організацію — додайте нотатки, зображення або аудіо' },
          { kind: 'text', text: 'Reggie та агенти LegioX увімкнуть модулі, брендинг і інтеграції з вашого брифу' },
          { kind: 'text', text: 'Ітеруйте в чаті, поки клон Ring не відповідає баченню — деплой на Ringdom або експорт' },
        ],
        note: {
          variant: 'development',
          title: 'З’явиться Q1 2026',
          body: 'Повне розмовне налаштування на LegioX.pro. До того — почніть на Ringdom з експертною ringization вже сьогодні.',
        },
        docLink: { href: 'https://legiox.pro', label: 'LegioX.pro' },
      },
      {
        id: 'promptor',
        name: 'Послуга Promptor',
        time: '1–4 тижні',
        audience: 'Організації, яким потрібен production-ready Ring з експертним супроводом.',
        tone: 'amber',
        route: [
          { kind: 'text', text: 'Тиждень 1 — Дослідження: кейс, вимоги, архітектура, обсяг' },
          { kind: 'text', text: 'Тижні 2–3 — Налаштування: брендинг, функції, БД, інтеграції, безпека' },
          { kind: 'text', text: 'Тиждень 4 — Доставка: продакшен, навчання команди, документація, передача' },
          { kind: 'text', text: 'Далі — Promptor оркеструє Legiox AI з необмеженими ітераціями' },
        ],
        includes: [
          'Сертифікований експерт + оркестрація Legiox AI',
          'Трансфер знань — навчитесь командувати Legiox самі',
          'Production-розгортання з безпекою та продуктивністю',
        ],
        note: {
          variant: 'success',
          title: 'Академія Громада',
          body: 'Хочете стати Promptor? Сертифікація через ігрове навчання Громада — з 2026.',
        },
      },
    ],
  },
  ru: {
    tablistLabel: 'Пути развёртывания',
    routeLabel: 'Маршрут',
    includesLabel: 'Вы получаете',
    copyLabel: 'Копировать',
    copiedLabel: 'Скопировано',
    paths: [
      {
        id: 'self-deploy',
        name: 'Мгновенный self-deploy',
        time: '~5 мин быстрый старт',
        audience:
          'Разработчики, клонирующие community edition. Полная PostgreSQL-primary установка обычно 45–90 мин — см. руководство по установке.',
        tone: 'emerald',
        route: [
          {
            kind: 'command',
            lead: 'Клонируйте open-source репозиторий Ring:',
            command: 'git clone https://github.com/connectplatform/ring.git\ncd ring',
          },
          {
            kind: 'command',
            lead: 'Запустите инсталлятор (рекомендуется — ring-config.json, .env.local, секреты):',
            command: 'chmod +x install.sh\n./install.sh --quick',
          },
          {
            kind: 'text',
            text: 'Заполните обязательные значения в .env.local — DATABASE_URL (PostgreSQL k8s-postgres-fcm), AUTH_SECRET и минимум один OAuth-провайдер.',
          },
          {
            kind: 'command',
            lead: 'Запустите единый dev-сервер (Next.js + WebSocket tunnel):',
            command: 'npm run dev',
          },
          {
            kind: 'url',
            lead: 'Откройте локальный экземпляр Ring:',
            href: 'http://localhost:3000',
          },
        ],
        includes: [
          'Все 20+ модулей, PostgreSQL-primary, Auth.js v5',
          'React 19 + Next.js 16 + install.sh',
          'Брендинг по умолчанию — настройте когда угодно',
          'Нулевая стоимость лицензии навсегда',
        ],
        docLink: { href: '/docs/getting-started/installation', label: 'Полное руководство по установке' },
      },
      {
        id: 'legiox',
        name: 'Настройка LegioX.pro',
        time: '10–30 минут',
        audience:
          'Не-разработчики описывают видение Ring в чате LegioX.pro — production-хостинг на Ringdom, managed Ring SaaS на ringdom.org.',
        tone: 'indigo',
        settlementPreview: true,
        ringdomBlurb:
          'Ringdom — managed Ring hosting SaaS: ringization под руководством LegioX, Kubernetes-операции и сопровождение поселения — turn-key путь, когда нужен результат, а не археология репозитория.',
        ringdomCta: { href: 'https://ringdom.org/en/settler', label: 'Start on Ringdom' },
        route: [
          { kind: 'text', text: 'Откройте settlement chat на LegioX.pro (тот же опыт на Ringdom)' },
          { kind: 'text', text: 'Опишите сообщество, продукт или организацию — прикрепите заметки, изображения или аудио' },
          { kind: 'text', text: 'Reggie и агенты LegioX включат модули, брендинг и интеграции из вашего брифа' },
          { kind: 'text', text: 'Итерируйте в чате, пока клон Ring не совпадёт с видением — деплой на Ringdom или экспорт' },
        ],
        note: {
          variant: 'development',
          title: 'Q1 2026',
          body: 'Полная conversational-настройка на LegioX.pro. До этого — начните на Ringdom с экспертной ringization уже сегодня.',
        },
        docLink: { href: 'https://legiox.pro', label: 'LegioX.pro' },
      },
      {
        id: 'promptor',
        name: 'Сервис Promptor',
        time: '1–4 недели',
        audience: 'Организации, которым нужен production-ready Ring с экспертным партнёрством.',
        tone: 'amber',
        route: [
          { kind: 'text', text: 'Неделя 1 — Discovery: кейс, требования, архитектура, scope' },
          { kind: 'text', text: 'Недели 2–3 — Customization: брендинг, фичи, БД, интеграции, hardening' },
          { kind: 'text', text: 'Неделя 4 — Delivery: продакшен, обучение, документация, handoff' },
          { kind: 'text', text: 'Далее — Promptor оркестрирует Legiox AI с неограниченными итерациями' },
        ],
        includes: [
          'Сертифицированный эксперт + оркестрация Legiox AI',
          'Transfer знаний — научитесь командовать Legiox сами',
          'Production-деплой с безопасностью и производительностью',
        ],
        note: {
          variant: 'success',
          title: 'Академия Громада',
          body: 'Хотите стать Promptor? Сертификация через игровое обучение Громада — с 2026.',
        },
      },
    ],
  },
}

const icons = [Rocket, Sparkles, Wrench] as const

const tabActive: Record<PathTone, string> = {
  emerald: 'border-emerald-500 bg-emerald-500/12 ring-2 ring-emerald-500/35 shadow-sm',
  indigo: 'border-indigo-500 bg-indigo-500/12 ring-2 ring-indigo-500/35 shadow-sm',
  amber: 'border-amber-500 bg-amber-500/12 ring-2 ring-amber-500/35 shadow-sm',
}

const tabIdle =
  'border-border bg-muted/25 hover:border-muted-foreground/25 hover:bg-muted/45'

const noteStyles: Record<PathNote['variant'], string> = {
  development: 'border-violet-500/30 bg-violet-500/8 text-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/8 text-foreground',
  info: 'border-border bg-muted/30 text-foreground',
}

function CopyButton({
  value,
  copyLabel,
  copiedLabel,
  className,
}: {
  value: string
  copyLabel: string
  copiedLabel: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      title={copied ? copiedLabel : copyLabel}
      aria-label={copied ? copiedLabel : copyLabel}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  )
}

function CopyableCommand({
  command,
  copyLabel,
  copiedLabel,
}: {
  command: string
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <div className="relative mt-1.5 overflow-hidden rounded-lg border border-border bg-muted/40 font-mono text-xs">
      <pre className="overflow-x-auto p-2.5 pr-11 leading-relaxed text-foreground">{command}</pre>
      <CopyButton
        value={command}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        className="absolute right-2 top-2"
      />
    </div>
  )
}

function CopyableUrl({
  href,
  copyLabel,
  copiedLabel,
}: {
  href: string
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-foreground">
      <a href={href} className="truncate hover:text-primary hover:underline">
        {href}
      </a>
      <CopyButton value={href} copyLabel={copyLabel} copiedLabel={copiedLabel} />
    </span>
  )
}

function RouteStepRow({
  step,
  index,
  copyLabel,
  copiedLabel,
}: {
  step: RouteStep
  index: number
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <li className="flex gap-3 text-sm text-foreground">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {step.kind === 'text' ? (
          <p className="leading-relaxed">{step.text}</p>
        ) : (
          <>
            <p className="leading-relaxed text-muted-foreground">{step.lead}</p>
            {step.kind === 'command' ? (
              <CopyableCommand command={step.command} copyLabel={copyLabel} copiedLabel={copiedLabel} />
            ) : (
              <CopyableUrl href={step.href} copyLabel={copyLabel} copiedLabel={copiedLabel} />
            )}
          </>
        )}
      </div>
    </li>
  )
}

function PathPanel({
  path,
  t,
  isActive,
  locale,
}: {
  path: DeployPath
  t: LocaleCopy
  isActive: boolean
  locale: DeploymentLocale
}) {
  return (
    <div
      className={cn(
        'col-start-1 row-start-1 p-4 transition-opacity duration-200 md:p-5',
        isActive ? 'relative z-10 opacity-100' : 'pointer-events-none invisible z-0 opacity-0',
      )}
      aria-hidden={!isActive}
    >
      <p className="mb-4 text-sm text-muted-foreground">{path.audience}</p>

      {path.settlementPreview ? (
        <RingLegioxSettlementChatPreview locale={locale} isActive={isActive} className="mb-5" />
      ) : null}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t.routeLabel}
      </p>
      <ol className="mb-4 space-y-3">
        {path.route.map((step, i) => (
          <RouteStepRow
            key={`${path.id}-${i}`}
            step={step}
            index={i}
            copyLabel={t.copyLabel}
            copiedLabel={t.copiedLabel}
          />
        ))}
      </ol>

      {path.includes && path.includes.length > 0 ? (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.includesLabel}
          </p>
          <ul className="mb-4 space-y-1.5">
            {path.includes.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {path.note ? (
        <div className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${noteStyles[path.note.variant]}`}>
          <p className="font-medium">{path.note.title}</p>
          <p className="mt-1 text-muted-foreground">{path.note.body}</p>
        </div>
      ) : null}

      {path.ringdomBlurb ? (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{path.ringdomBlurb}</p>
      ) : null}

      {path.ringdomCta ? (
        <div className="mb-4 max-w-md">
          <BorderBeam className="w-full rounded-xl" innerClassName={cn(davinciBeamInnerSurface, 'border-0')}>
            <DavinciCtaLink href={path.ringdomCta.href} className="w-full">
              {path.ringdomCta.label}
            </DavinciCtaLink>
          </BorderBeam>
        </div>
      ) : null}

      {path.docLink ? (
        <a
          href={path.docLink.href}
          className="text-sm font-medium text-primary hover:underline"
          {...(path.docLink.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {path.docLink.label} →
        </a>
      ) : null}
    </div>
  )
}

export interface RingDeploymentPathsProps {
  locale?: DeploymentLocale
  defaultPath?: number
}

export function RingDeploymentPaths({ locale = 'en', defaultPath = 0 }: RingDeploymentPathsProps) {
  const t = copy[locale] ?? copy.en
  const paths = t.paths
  const [active, setActive] = useState(() => Math.min(Math.max(defaultPath, 0), paths.length - 1))

  const select = useCallback((index: number) => setActive(index), [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index + 1) % paths.length)
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index - 1 + paths.length) % paths.length)
      }
    },
    [paths.length],
  )

  return (
    <div className="my-4 w-full min-w-0">
      <div
        role="tablist"
        aria-label={t.tablistLabel}
        className="grid w-full gap-2 sm:grid-cols-3"
      >
        {paths.map((path, index) => {
          const Icon = icons[index]
          const isActive = active === index
          return (
            <button
              key={path.id}
              type="button"
              role="tab"
              id={`deploy-tab-${path.id}`}
              aria-selected={isActive}
              aria-controls={`deploy-panel-${path.id}`}
              tabIndex={isActive ? 0 : -1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(index)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                'flex flex-col rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] md:p-4',
                isActive ? tabActive[path.tone] : tabIdle,
              )}
            >
              <div className="mb-2 flex items-start gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden />
                </span>
                <span className="text-sm font-semibold leading-snug text-foreground">{path.name}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {path.time}
              </span>
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`deploy-panel-${paths[active].id}`}
        aria-labelledby={`deploy-tab-${paths[active].id}`}
        className="mt-3 w-full overflow-hidden rounded-xl border border-border/80 bg-muted/15"
      >
        <div className="grid">
          {paths.map((path, index) => (
            <PathPanel key={path.id} path={path} t={t} isActive={active === index} locale={locale} />
          ))}
        </div>
      </div>
    </div>
  )
}
