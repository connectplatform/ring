/**
 * Publisher Get Started Flow Component
 *
 * Displays a vertical pipeline of steps for getting started with the publisher.
 * Used in the about-publisher right rail.
 *
 * @author LegioX Commander
 * @version 1.0.0
 */

'use client'

import { ChevronDown, Rocket } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { davinciCtaPrimary, davinciGlassSurface, davinciTerminalSurface } from '@/lib/ui/davinci'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

export interface PublisherGetStartedFlowProps {
  locale: Locale
}

/**
 * Compact ring-widget style clone pipeline for the about-publisher right rail.
 */
export function PublisherGetStartedFlow({ locale }: PublisherGetStartedFlowProps) {
  const t = useTranslations('about-publisher')

  const steps = [
    t('sidebar.flow.step_install'),
    t('sidebar.flow.step_config'),
    t('sidebar.flow.step_deploy'),
  ] as const

  return (
    <section className="space-y-3" aria-labelledby="publisher-get-started-heading">
      <h3
        id="publisher-get-started-heading"
        className="px-0.5 text-sm font-semibold tracking-tight text-foreground"
      >
        {t('sidebar.quick_actions')}
      </h3>

      <div
        className={cn(davinciGlassSurface, 'p-3')}
        data-testid="publisher-clone-flow"
      >
        <ol className="list-none space-y-0">
          {steps.map((label, index) => (
            <li key={label} className="flex flex-col items-center">
              <div
                className={cn(
                  davinciTerminalSurface,
                  'w-full px-3 py-2 text-center text-xs font-medium text-foreground',
                  index === 0 && 'font-mono',
                )}
              >
                {label}
              </div>
              {index < steps.length - 1 ? (
                <ChevronDown
                  className="my-0.5 size-4 shrink-0 text-[var(--davinci-beam)]"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <a
        href={ROUTES.DOCS_GETTING_STARTED(locale)}
        className={cn(
          davinciCtaPrimary,
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0',
        )}
        data-testid="publisher-quick-start"
      >
        <Rocket className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
        {t('sidebar.flow.quick_start')}
      </a>
    </section>
  )
}
