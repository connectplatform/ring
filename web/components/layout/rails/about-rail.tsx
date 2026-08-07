'use client'

/**
 * ABOUT RAIL — DaVinci glass right-rail for About / AI-Web3 / Global Impact / Contact.
 * Matches about-publisher rail density: chips, glass stats, primary CTA — no Card shells.
 */

import React, { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  ExternalLink,
  Globe,
  HelpCircle,
  Info,
  Mail,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import { GithubIcon } from '@/components/ui/icons/github-icon'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { Locale } from '@/i18n/shared'
import type {
  SidebarCommunityLinkConfig,
  SidebarLinkConfig,
  SidebarStatConfig,
} from '@/lib/ring-config-types'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  DavinciGlassStatBlock,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

const ICON_BY_NAME: Record<string, React.ReactNode> = {
  Info: <Info className="h-3.5 w-3.5" />,
  Globe: <Globe className="h-3.5 w-3.5" />,
  BookOpen: <BookOpen className="h-3.5 w-3.5" />,
  Users: <Users className="h-3.5 w-3.5" />,
  Mail: <Mail className="h-3.5 w-3.5" />,
  MessageSquare: <MessageSquare className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
}

function resolveConfigPath(config: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = config
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' && cur.trim() ? cur : undefined
}

function sidebarKey(labelKey: string): string {
  return labelKey.replace(/^about\.sidebar\./, '')
}

function resolveSidebarIcon(icon: SidebarLinkConfig['icon']): React.ReactNode {
  if (!icon) return <ExternalLink className="h-3.5 w-3.5" />
  if (typeof icon === 'string') {
    return ICON_BY_NAME[icon] ?? <ExternalLink className="h-3.5 w-3.5" />
  }
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
      className: 'h-3.5 w-3.5',
    })
  }
  return <ExternalLink className="h-3.5 w-3.5" />
}

export interface AboutSidebarContentProps {
  locale: Locale
  onNavigate?: () => void
}

export default function AboutSidebarContent({ locale, onNavigate }: AboutSidebarContentProps) {
  const t = useTranslations('about.sidebar')
  const ringConfig = getSystemConfigSnapshot() as unknown as Record<string, unknown>

  const quickLinks = useMemo(() => {
    const links = (ringConfig?.sidebar as { quickLinks?: SidebarLinkConfig[] } | undefined)
      ?.quickLinks ?? []
    return links.map((link) => ({
      ...link,
      label: t(sidebarKey(link.labelKey)),
      iconNode: resolveSidebarIcon(link.icon),
    }))
  }, [ringConfig, t])

  const communityLinks = useMemo(() => {
    const links = (ringConfig?.sidebar as { community?: SidebarCommunityLinkConfig[] } | undefined)
      ?.community ?? []
    return links.map((link) => {
      const url =
        resolveConfigPath(ringConfig, link.urlKey) ||
        resolveConfigPath(ringConfig, `urls.${link.urlKey}`) ||
        link.urlKey
      return {
        ...link,
        label: t(sidebarKey(link.labelKey)),
        url,
      }
    })
  }, [ringConfig, t])

  const stats = useMemo(() => {
    const rows = (ringConfig?.sidebar as { stats?: SidebarStatConfig[] } | undefined)?.stats ?? []
    return rows.map((stat) => {
      let value = stat.value
      if (stat.valueKey) {
        value =
          resolveConfigPath(ringConfig, stat.valueKey) ||
          // Fallbacks for older snapshots
          (stat.valueKey === 'clone.version'
            ? resolveConfigPath(ringConfig, 'version')
            : undefined) ||
          (stat.valueKey === 'legal.licenseSpdx'
            ? resolveConfigPath(ringConfig, 'licenseSpdx')
            : undefined)
      }
      return {
        label: t(sidebarKey(stat.labelKey)),
        value: value?.trim() || '—',
      }
    })
  }, [ringConfig, t])

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby="about-platform-heading">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          <h2 id="about-platform-heading" className="text-sm font-semibold tracking-tight text-foreground">
            {t('platformInfo')}
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('platformInfoDesc')}</p>
        {stats.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {stats.map((stat) => (
              <DavinciGlassStatBlock
                key={stat.label}
                value={stat.value}
                label={stat.label}
                hint=""
                beamOnHover={false}
              />
            ))}
          </div>
        ) : null}
      </section>

      {quickLinks.length > 0 ? (
        <section className="space-y-3" aria-labelledby="about-quick-links-heading">
          <h3
            id="about-quick-links-heading"
            className="px-0.5 text-sm font-semibold tracking-tight text-foreground"
          >
            {t('quickLinks')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <DavinciGlassChip
                key={link.href}
                href={`/${locale}${link.href.startsWith('/') ? link.href : `/${link.href}`}`}
                icon={link.iconNode}
              >
                {link.label}
              </DavinciGlassChip>
            ))}
          </div>
        </section>
      ) : null}

      {communityLinks.length > 0 ? (
        <section className="space-y-3" aria-labelledby="about-community-heading">
          <h3
            id="about-community-heading"
            className="px-0.5 text-sm font-semibold tracking-tight text-foreground"
          >
            {t('community')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {communityLinks.map((link) => (
              <DavinciGlassChip
                key={link.urlKey}
                href={link.url}
                external
                icon={
                  link.urlKey.includes('github') ? (
                    <GithubIcon className="h-3 w-3" />
                  ) : (
                    <ExternalLink className="h-3 w-3" />
                  )
                }
              >
                {link.label}
              </DavinciGlassChip>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="about-help-heading">
        <div className="flex items-center gap-2 px-0.5">
          <HelpCircle className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          <h3 id="about-help-heading" className="text-sm font-semibold tracking-tight text-foreground">
            {t('needHelp')}
          </h3>
        </div>
        <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">{t('needHelpDesc')}</p>
        <a
          href={ROUTES.DOCS(locale)}
          onClick={onNavigate}
          className={cn(
            davinciCtaPrimary,
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0',
          )}
        >
          <BookOpen className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          {t('documentation')}
        </a>
        <a
          href={ROUTES.CONTACT(locale)}
          onClick={onNavigate}
          className={cn(
            davinciGlassSurface,
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
          )}
        >
          <Mail className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          {t('contactSupport')}
        </a>
      </section>
    </div>
  )
}
