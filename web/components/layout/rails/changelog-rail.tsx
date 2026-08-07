'use client'

/**
 * CHANGELOG RAIL — publisher/project facts + report/publisher CTAs
 */

import React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Building2, Heart, Package } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { davinciAuthButtonLift, davinciCtaPrimary, davinciTerminalSurface, DavinciGlassChip } from '@/lib/ui/davinci'

export interface ChangelogRailProps {
  locale: string
  publisherName: string
  projectName: string
  projectDescription: string
  version: string
  organization?: string
  contactEmail?: string
  onNavigate?: () => void
}

export function ChangelogRail({
  publisherName,
  projectName,
  projectDescription,
  version,
  organization,
  contactEmail,
  onNavigate,
}: ChangelogRailProps) {
  const t = useTranslations('navigation')

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby="changelog-project-heading">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <h2
            id="changelog-project-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {t('changelog.project', { default: 'Project' })}
          </h2>
        </div>
        <p className="text-sm font-medium text-foreground">{projectName}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{projectDescription}</p>
        <div className="flex flex-wrap gap-2">
          <DavinciGlassChip icon={<Package className="h-3 w-3" />}>v{version}</DavinciGlassChip>
          {organization ? (
            <DavinciGlassChip icon={<Building2 className="h-3 w-3" />}>{organization}</DavinciGlassChip>
          ) : null}
        </div>
        {contactEmail ? (
          <p className="text-[11px] text-muted-foreground">
            <a href={`mailto:${contactEmail}`} className="hover:underline">
              {contactEmail}
            </a>
          </p>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="changelog-publisher-heading">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
          <h2
            id="changelog-publisher-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {t('changelog.publisher', { default: 'Publisher' })}
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{publisherName}</p>
      </section>

      <section className="space-y-2">
        <Link
          href="/contact"
          onClick={onNavigate}
          className={cn(
            davinciCtaPrimary,
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0',
          )}
        >
          <AlertTriangle className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          {t('changelog.reportErrors', { default: 'Report errors' })}
        </Link>
        <Link
          href="/about-publisher"
          onClick={onNavigate}
          className={cn(
            davinciTerminalSurface,
            davinciAuthButtonLift,
            'flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-foreground',
          )}
        >
          <Heart className="size-4 shrink-0 text-red-500" aria-hidden />
          {t('changelog.publisherPage', { default: 'Publisher page' })}
        </Link>
      </section>
    </div>
  )
}
