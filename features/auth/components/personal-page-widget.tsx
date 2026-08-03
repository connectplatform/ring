'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, Globe2, Layout } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { FsModal } from '@/components/ui/fs-modal'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import { getPersonalPageViewStats } from '@/features/auth/services/personal-page-stats'
import type { PersonalPageViewStats } from '@/features/auth/services/personal-page-stats-types'
import {
  PERSONAL_PAGE_FIELDS,
  PERSONAL_PAGE_SECTION_IDS,
  acceptsProfileDms,
  normalizePersonalPageSections,
  normalizePublicProfileFields,
  personalPageFieldEnabled,
  type PersonalPageSectionId,
  type PublicProfileFieldsMap,
} from '@/features/auth/lib/personal-page-sections'

export { PERSONAL_PAGE_SECTION_IDS, type PersonalPageSectionId }

export type PersonalPageWidgetProps = {
  username?: string | null
  publicProfile: boolean
  publicProfileSections?: string[] | null
  publicProfileFields?: PublicProfileFieldsMap | null
  acceptProfileDms?: boolean | null
  onOpenUsernameModal: () => void
  onPublicProfileChange?: (
    enabled: boolean,
    sections: string[],
    fields: PublicProfileFieldsMap,
    acceptDms: boolean,
  ) => void
  className?: string
}

function fieldLabelKey(section: PersonalPageSectionId, field: string): string {
  return `field_${section}_${field}`
}

/**
 * Personal page interactive widget — tap opens Page Builder FsModal.
 * Persist note: avoid `router.refresh()` — remounts root beforeInteractive Scripts.
 */
export function PersonalPageWidget({
  username,
  publicProfile,
  publicProfileSections,
  publicProfileFields,
  acceptProfileDms: acceptDmsProp,
  onOpenUsernameModal,
  onPublicProfileChange,
  className,
}: PersonalPageWidgetProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(publicProfile)
  const [sections, setSections] = useState<PersonalPageSectionId[]>(() =>
    normalizePersonalPageSections(publicProfileSections),
  )
  const [fields, setFields] = useState<PublicProfileFieldsMap>(() =>
    normalizePublicProfileFields(publicProfileFields),
  )
  const [acceptDms, setAcceptDms] = useState(() => acceptsProfileDms(acceptDmsProp))
  const [stats, setStats] = useState<PersonalPageViewStats>({
    today: 0,
    last7d: 0,
    unique24h: 0,
    unique7d: 0,
    visits24h: 0,
    visits7d: 0,
    byRole24h: [],
    byRole7d: [],
    hasData: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEnabled(publicProfile)
    setSections(normalizePersonalPageSections(publicProfileSections))
    setFields(normalizePublicProfileFields(publicProfileFields))
    setAcceptDms(acceptsProfileDms(acceptDmsProp))
  }, [publicProfile, publicProfileSections, publicProfileFields, acceptDmsProp])

  useEffect(() => {
    if (!publicProfile || !username) {
      setStats({
        today: 0,
        last7d: 0,
        unique24h: 0,
        unique7d: 0,
        visits24h: 0,
        visits7d: 0,
        byRole24h: [],
        byRole7d: [],
        hasData: false,
      })
      return
    }
    let cancelled = false
    void getPersonalPageViewStats(username)
      .then((next) => {
        if (!cancelled) setStats(next)
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            today: 0,
            last7d: 0,
            unique24h: 0,
            unique7d: 0,
            visits24h: 0,
            visits7d: 0,
            byRole24h: [],
            byRole7d: [],
            hasData: false,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [publicProfile, username])

  const siteHost = typeof window !== 'undefined' ? window.location.host : ''
  const publicUrl = username ? `${siteHost}/${username}` : ''

  const sectionMeta = useMemo(
    () =>
      [
        { id: 'bio' as const, label: t('bio') || 'Bio' },
        { id: 'messengers' as const, label: t('messengers') || 'Messengers' },
        {
          id: 'professional' as const,
          label: t('professionalProfile') || 'Professional Profile',
        },
        { id: 'location' as const, label: t('location') || 'Location' },
        { id: 'contact' as const, label: t('contactData') || 'Contact Data' },
      ] as const,
    [t],
  )

  const persist = useCallback(
    async (
      nextEnabled: boolean,
      nextSections: string[],
      nextFields: PublicProfileFieldsMap,
      nextAcceptDms: boolean,
    ) => {
      setSaving(true)
      try {
        const formData = new FormData()
        formData.append('publicProfile', nextEnabled ? 'true' : 'false')
        formData.append('publicProfileSections', JSON.stringify(nextSections))
        formData.append('publicProfileFields', JSON.stringify(nextFields))
        formData.append('acceptProfileDms', nextAcceptDms ? 'true' : 'false')
        const { updateProfile } = await import('@/app/_actions/profile')
        const result = await updateProfile({ success: false, message: '' }, formData)
        if (result.success) {
          await updateSession().catch(() => undefined)
          onPublicProfileChange?.(nextEnabled, nextSections, nextFields, nextAcceptDms)
        }
      } finally {
        setSaving(false)
      }
    },
    [onPublicProfileChange, updateSession],
  )

  const toggleSection = (id: PersonalPageSectionId) => {
    if (!enabled || saving) return
    const has = sections.includes(id)
    const next = has ? sections.filter((x) => x !== id) : [...sections, id]
    const safe = normalizePersonalPageSections(next)
    setSections(safe)
    void persist(enabled, safe, fields, acceptDms)
  }

  const toggleField = (section: PersonalPageSectionId, field: string) => {
    if (!enabled || saving || !sections.includes(section)) return
    const currentlyOn = personalPageFieldEnabled(fields, section, field)
    const next: PublicProfileFieldsMap = {
      ...fields,
      [section]: {
        ...(fields[section] as Record<string, boolean> | undefined),
        [field]: !currentlyOn,
      },
    }
    const normalized = normalizePublicProfileFields(next)
    setFields(normalized)
    void persist(enabled, sections, normalized, acceptDms)
  }

  const handleEnabledChange = (next: boolean) => {
    if (next && !username) {
      setOpen(false)
      onOpenUsernameModal()
      return
    }
    setEnabled(next)
    void persist(next, sections, fields, acceptDms)
  }

  const handleAcceptDmsChange = (next: boolean) => {
    if (saving) return
    setAcceptDms(next)
    void persist(enabled, sections, fields, next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          davinciGlassSurface,
          'flex w-full flex-col gap-3 p-4 text-left transition-colors',
          'hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--davinci-beam)_16%,transparent)] text-[var(--davinci-beam)]">
            <Globe2 className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {t('personalPageWidgetTitle') || 'Personal page'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {enabled
                ? t('personalPageWidgetActive') || 'Your public profile is live'
                : t('personalPageWidgetInactive') ||
                  'Personal page is off — tap to configure'}
            </p>
            {enabled && username ? (
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                /{username}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              enabled
                ? 'bg-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)] text-[var(--davinci-beam)]'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {enabled ? t('personalPageOn') || 'ON' : t('personalPageOff') || 'OFF'}
          </span>
        </div>

        {enabled ? (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Eye className="size-3" />
                  {t('personalPageUnique24h') || 'Unique 24h'}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--davinci-beam)]">
                  {stats.unique24h}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t('personalPageUnique7d') || 'Unique 7d'}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {stats.unique7d}
                </p>
              </div>
            </div>
            {(stats.byRole24h.length > 0 || stats.byRole7d.length > 0) && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t('personalPageByRole') || 'By role'}
                </p>
                <ul className="space-y-0.5">
                  {(stats.byRole7d.length ? stats.byRole7d : stats.byRole24h).map((bucket) => {
                    const day =
                      stats.byRole24h.find((r) => r.role === bucket.role)?.unique ?? 0
                    return (
                      <li
                        key={bucket.role}
                        className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                      >
                        <span className="truncate capitalize">{bucket.role}</span>
                        <span className="shrink-0 tabular-nums text-foreground">
                          {day}
                          <span className="text-muted-foreground"> / </span>
                          {bucket.unique}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="text-[10px] text-muted-foreground/80">
                  {t('personalPageByRoleHint') || '24h / 7d unique'}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </button>

      <FsModal
        open={open}
        onOpenChange={setOpen}
        title={t('pageBuilder') || 'Page Builder'}
        description={
          t('pageBuilderDescription') || 'Choose what appears on your public profile'
        }
        hideHeaderSeparator
        className="sm:h-auto sm:max-h-[90dvh]"
        contentClassName="!py-3"
        footer={
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Layout className="mt-0.5 size-3.5 shrink-0" />
            {t('pageBuilderFooterLive') ||
              'Toggle sections and fields. Changes save immediately.'}
          </p>
        }
      >
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('personalPage') || 'Personal page'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {enabled
                ? publicUrl || `/${username || ''}`
                : t('personalPagePrivate')}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t('acceptProfileDms') || 'Accept messages from profile'}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('acceptProfileDmsHint') ||
                'When off, subscribers cannot contact you via your personal page'}
            </p>
          </div>
          <Switch
            checked={acceptDms}
            disabled={saving}
            onCheckedChange={handleAcceptDmsChange}
          />
        </div>

        <ul className="space-y-2">
          {sectionMeta.map((section) => {
            const selected = sections.includes(section.id)
            const fieldIds = PERSONAL_PAGE_FIELDS[section.id]
            return (
              <li key={section.id} className="rounded-lg border border-border/40">
                <button
                  type="button"
                  disabled={!enabled || saving}
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected && enabled && 'bg-accent/40',
                    (!enabled || saving) && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border',
                      selected && enabled
                        ? 'border-[var(--davinci-beam)] bg-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)] text-[var(--davinci-beam)]'
                        : 'border-border text-transparent',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 font-medium">{section.label}</span>
                </button>
                {selected && enabled ? (
                  <ul className="space-y-1 border-t border-border/30 px-3 py-2">
                    {fieldIds.map((field) => {
                      const on = personalPageFieldEnabled(fields, section.id, field)
                      return (
                        <li
                          key={field}
                          className="flex items-center justify-between gap-2 py-1 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {t(fieldLabelKey(section.id, field)) || field}
                          </span>
                          <Switch
                            checked={on}
                            disabled={saving}
                            onCheckedChange={() => toggleField(section.id, field)}
                          />
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>

        {!username ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => {
              setOpen(false)
              onOpenUsernameModal()
            }}
          >
            {t('setUsernameFirst') || 'Set a username first'}
          </Button>
        ) : null}
      </FsModal>
    </>
  )
}

export default PersonalPageWidget
