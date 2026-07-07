'use client'

// About right-rail content for the platform's About page

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Info,
  HelpCircle,
  ExternalLink,
  BookOpen,
  MessageSquare,
} from 'lucide-react'
import {
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import type { Locale } from '@/i18n/shared'
import type {
  SidebarLinkConfig,
  SidebarCommunityLinkConfig,
  SidebarStatConfig,
  SidebarStatValueKey,
} from '@/lib/ring-config-types'

import Link from 'next/link' // Using Next.js <Link> for SPA navigation

// CONFIG-BASED LOGIC: interface mirroring ring-config-types

/**
 * Helper for icon rendering. Accepts various possible icon forms:
 *  - string (legacy or custom URL): fallback to default
 *  - React node/component: clone with correct className
 *  Returns a rendered icon node.
 */
// TODO: Switch to React 19's new functionally enhanced <Icon> prop in future updates if available.
function renderSidebarIcon(
  icon: SidebarLinkConfig['icon'],
  fallback: React.ReactNode = <ExternalLink className="h-4 w-4 mr-2" />
) {
  if (!icon) return fallback
  if (typeof icon === 'string') {
    // STUB: handle image URLs or named icon string
    // TODO(step 1): If icon is a valid URL, render <img> with alt/fallback; if custom string, map to library
    return fallback
  }
  // Is a valid ReactNode/component (preferred)
  return React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { className: 'h-4 w-4 mr-2' })
    : fallback
}

/**
 * Reads sidebar quickLinks from config and localizes the label.
 * Uses the translation function `t` for the labelKey.
 * @param config Configuration object
 * @param t Translation function
 * @param locale Current locale
 */
function getSidebarLinksFromConfig(
  config: any,
  t: ReturnType<typeof useTranslations>,
  locale: string
): SidebarLinkConfig[] {
  // Extracts quickLinks from config
  const links: SidebarLinkConfig[] = config?.sidebar?.quickLinks || []
  return links.map(link => ({
    ...link,
    // Localize the label using translation function; remove namespace prefix if exists
    label: t(link.labelKey.replace(/^about\.sidebar\./, ''))
  }))
}

/**
 * Reads community links from config, localizes the label, and resolves the URL.
 * Converts a URL key to a concrete URL string, with fallback to the key itself.
 * @param config Configuration object
 * @param t Translation function
 * @param locale Current locale
 */
// TODO: Update return type for clarity in future codegen/codemod passes.
function getSidebarCommunityLinksFromConfig(
  config: any,
  t: ReturnType<typeof useTranslations>,
  locale: string
): Array<SidebarCommunityLinkConfig & { label: string, url: string }> {
  const links: SidebarCommunityLinkConfig[] = config?.sidebar?.community || []
  return links.map(link => ({
    ...link,
    label: t(link.labelKey.replace(/^about\.sidebar\./, '')),
    // Prefer mapping urlKey through config.urls, else treat as literal
    url: config.urls?.[link.urlKey] || link.urlKey,
  }))
}

/**
 * Reads sidebar stats from config. Supports literal `value` or dynamic `valueKey`.
 * Returns array of { label, value } objects for display.
 * @param config Configuration object
 * @param t Translation function
 */
function getSidebarStatsFromConfig(
  config: any,
  t: ReturnType<typeof useTranslations>
): { label: string, value: string }[] {
  // The config provides an array of stat configs
  const stats: SidebarStatConfig[] = config?.sidebar?.stats || []
  return stats.map(stat => {
    let value: string | undefined = stat.value
    // Support for dynamic value resolution based on valueKey
    if (stat.valueKey) {
      if (stat.valueKey === 'clone.version') {
        value = config.version || 'n/a'
      } else if (stat.valueKey === 'legal.licenseSpdx') {
        value = config.licenseSpdx || 'n/a'
      }
      // STUB: Add additional dynamic keys as config evolves
      // TODO(step 2): Add broader dynamic value resolution using known mappings or factory
    }
    return {
      label: t(stat.labelKey.replace(/^about\.sidebar\./, '')),
      value: value ?? '',
    }
  })
}

export interface AboutSidebarContentProps {
  locale: Locale
  onNavigate?: () => void
}

/**
 * Main React component for the About right-rail.
 * Shows info summary, quick links, stats, community links, and help CTAs.
 */
export default function AboutSidebarContent({ locale, onNavigate }: AboutSidebarContentProps) {
  // TODO: Consider using the new useRouter from next/navigation or react-router 19 as APIs evolve
  // Only for legacy purposes (can be removed when all navigation flows migrate to <Link>)
  const router = useRouter()

  // Translation function for about.sidebar namespace
  const t = useTranslations('about.sidebar')

  // STUB: Replace with react's use() + async loader when Next.js supports client async hook.
  const ringConfig = getSystemConfigSnapshot()

  // -- Config-driven data resolution ----------------------------------------
  const quickLinks = getSidebarLinksFromConfig(ringConfig, t, locale)
  const communityLinks = getSidebarCommunityLinksFromConfig(ringConfig, t, locale)
  const stats = getSidebarStatsFromConfig(ringConfig, t)
  // ------------------------------------------------------------------------

  /**
   * Handler for navigating to an internal path with optional callback.
   * Modern code paths should prefer <Link> for SPA navigation.
   */
  // TODO: Remove handleNav in favor of <Link> navigations once all usages are migrated. 
  const handleNav = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  // TODO: If onNavigate is only used with <Link/> and not for imperative push, consider removing or refactoring for event batching with new React <Actions> API.

  return (
    <div className="space-y-6">
      {/* -------- Platform Info Card -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {/* Translated Platform Info Title */}
            {t('platformInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {/* Localized description of the platform */}
          <p>{t('platformInfoDesc')}</p>
          {/* Conditional: Show stats only if available */}
          {stats.length > 0 && (
            <div className="space-y-2">
              {stats.map((stat) => (
                <div key={stat.label} className="flex justify-between">
                  <span>{stat.label}</span>
                  <span className="font-medium text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------- Quick Links Card -------- */}
      {quickLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('quickLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Use Next.js <Link> for SPA navigation */}
            {quickLinks.map((link: SidebarLinkConfig) => {
              const icon = renderSidebarIcon(link.icon as React.ReactNode)
              return (
                // TODO: Remove passHref in Next.js 14+ (deprecated, as <Link> always passes href)
                <Link
                  href={link.href}
                  key={link.href}
                  onClick={onNavigate}
                  className="w-full block"
                >
                  {/* Button asChild pattern gives <span> correct semantics */}
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full justify-start"
                  >
                    <span>
                      {icon}
                      {/* TODO: Use link.label (localized) in display, fallback to labelKey only in error */}
                      {link.labelKey}
                    </span>
                  </Button>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* -------- Community Links Card (External) -------- */}
      {communityLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('community')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {communityLinks.map((link) => (
              // Open external community link in new tab
              // TODO: Consider adding dynamic icons per link type in future
              <a
                key={link.urlKey}
                href={link.url} // Use resolved URL, not key
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block"
              >
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <span>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {/* TODO: Use link.label (localized) in display, fallback to labelKey only in error */}
                    {link.labelKey}
                  </span>
                </Button>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* -------- Need Help Card -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('needHelp')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {/* Localized support description */}
          <p>{t('needHelpDesc')}</p>
          <div className="space-y-2">
            {/* Button links to /docs and /contact, localized by locale */}
            <Link href={`/${locale}/docs`} className="block" onClick={onNavigate}>
              <Button
                asChild
                variant="link"
                className="p-0 h-auto text-sm"
              >
                <span>{t('documentation')}</span>
              </Button>
            </Link>
            <Link href={`/${locale}/contact`} className="block" onClick={onNavigate}>
              <Button
                asChild
                variant="link"
                className="p-0 h-auto text-sm"
              >
                <span>{t('contactSupport')}</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
