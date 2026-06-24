/**
 * Ring Welcome Feature Explorer Component
 *
 * Displays a grid of feature cards with icons and descriptions.
 * Used in the welcome and onboarding pages.
 *
 * @author LegioX Commander
 * @version 1.0.0
 */

'use client'

import { ArrowRight } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  getWelcomeFeatureExplorerCopy,
  type WelcomeFeatureItem,
  type WelcomeFeatureSection,
  type WelcomeFeatureTheme,
} from '@/lib/ring-widgets/welcome-features'
import type { Locale } from '@/i18n/shared'

export interface RingWelcomeFeatureExplorerProps {
  locale?: Locale
  theme?: WelcomeFeatureTheme
  title?: string
  subtitle?: string
}

function ThemeRoot({
  theme,
  children,
}: {
  theme: WelcomeFeatureTheme
  children: React.ReactNode
}) {
  if (theme === 'dark') {
    return (
      <div className="dark rounded-2xl border border-border bg-gray-950 text-gray-50 [&_.bg-card]:bg-gray-900/90">
        {children}
      </div>
    )
  }
  if (theme === 'light') {
    return (
      <div className="rounded-2xl border border-border bg-white text-gray-900 shadow-sm [&_.bg-card]:bg-white">
        {children}
      </div>
    )
  }
  return <>{children}</>
}

function FeatureWidgetCard({
  item,
  openDocLabel,
}: {
  item: WelcomeFeatureItem
  openDocLabel: string
}) {
  return (
    <a
      href={item.href}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border border-border/80 bg-card/90 p-3 text-left shadow-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
      data-testid={`welcome-feature-${item.id}`}
      aria-label={`${item.title} — ${openDocLabel}`}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-lg"
        aria-hidden
      >
        {item.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
          {item.title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {item.description}
        </span>
      </span>
      <ArrowRight
        className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--davinci-beam)]"
        aria-hidden
      />
    </a>
  )
}

function FeatureSectionStack({
  sections,
  openDocLabel,
}: {
  sections: WelcomeFeatureSection[]
  openDocLabel: string
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <h4 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </h4>
          <ul className="list-none space-y-2">
            {section.items.map((item) => (
              <li key={item.id}>
                <FeatureWidgetCard item={item} openDocLabel={openDocLabel} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function RingWelcomeFeatureExplorer({
  locale: localeProp,
  theme = 'inherit',
  title,
  subtitle,
}: RingWelcomeFeatureExplorerProps) {
  const routeLocale = useLocale() as Locale
  const locale = localeProp ?? routeLocale
  const copy = getWelcomeFeatureExplorerCopy(locale)
  const [tab, setTab] = useState<'product' | 'developer'>('product')

  const displayTitle = title ?? copy.title
  const displaySubtitle = subtitle ?? copy.subtitle

  return (
    <ThemeRoot theme={theme}>
      <figure
        className="ring-widget-welcome-features my-8 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        data-theme={theme}
        data-locale={locale}
      >
        <figcaption className="border-b border-border px-4 py-3 md:px-5">
          <p className="text-base font-semibold tracking-tight text-foreground md:text-lg">
            {displayTitle}
          </p>
          {displaySubtitle ? (
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">{displaySubtitle}</p>
          ) : null}
        </figcaption>

        <div className="px-3 py-4 md:px-5 md:py-5">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as 'product' | 'developer')}
            className="w-full"
          >
            <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 p-1">
              <TabsTrigger value="product" className="text-xs sm:text-sm">
                {copy.tabProductOwner}
              </TabsTrigger>
              <TabsTrigger value="developer" className="text-xs sm:text-sm">
                {copy.tabDeveloper}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="mt-0 focus-visible:outline-none">
              <FeatureSectionStack sections={copy.productOwner} openDocLabel={copy.openDoc} />
            </TabsContent>

            <TabsContent value="developer" className="mt-0 focus-visible:outline-none">
              <FeatureSectionStack sections={copy.developer} openDocLabel={copy.openDoc} />
            </TabsContent>
          </Tabs>
        </div>
      </figure>
    </ThemeRoot>
  )
}
