'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Check, Construction, Copy, Eye, Globe2, Layout, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { FsModal } from '@/components/ui/fs-modal'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import { getPersonalPageViewStats } from '@/features/auth/services/personal-page-stats'
import type { PersonalPageViewStats } from '@/features/auth/services/personal-page-stats-types'
import { appendReferralFragment } from '@/features/refcodes/lib/referral-share-url'
import {
  PERSONAL_PAGE_FIELDS,
  PERSONAL_PAGE_SECTION_IDS,
  acceptsProfileDms,
  normalizePersonalPageSections,
  normalizePublicProfileFields,
  normalizePublicProfileMedia,
  personalPageFieldEnabled,
  personalPageMediaVisible,
  showNftListings,
  type PersonalPageMediaId,
  type PersonalPageSectionId,
  type PublicProfileFieldsMap,
  type PublicProfileMediaMap,
} from '@/features/auth/lib/personal-page-sections'

export { PERSONAL_PAGE_SECTION_IDS, type PersonalPageSectionId }

const EMPTY_STATS: PersonalPageViewStats = {
  today: 0,
  last7d: 0,
  unique24h: 0,
  unique7d: 0,
  visits24h: 0,
  visits7d: 0,
  byRole24h: [],
  byRole7d: [],
  privateUnique24h: 0,
  privateUnique7d: 0,
  hasData: false,
}

export type PersonalPageWidgetProps = {
  username?: string | null
  publicProfile: boolean
  publicProfileSections?: string[] | null
  publicProfileFields?: PublicProfileFieldsMap | null
  acceptProfileDms?: boolean | null
  publicProfileNftListings?: boolean | null
  publicProfileMedia?: PublicProfileMediaMap | null
  onOpenUsernameModal: () => void
  onPublicProfileChange?: (
    enabled: boolean,
    sections: string[],
    fields: PublicProfileFieldsMap,
    acceptDms: boolean,
    nftListings: boolean,
    media: PublicProfileMediaMap,
  ) => void
  className?: string
}

function fieldLabelKey(section: PersonalPageSectionId, field: string): string {
  return `field_${section}_${field}`
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden>
      <span
        className={cn(
          'absolute inset-0 rounded-full',
          on ? 'bg-green-500 animate-pulse' : 'bg-gray-500',
        )}
      />
      {on ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-75" />
      ) : null}
    </span>
  )
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
  publicProfileNftListings: nftProp,
  publicProfileMedia: mediaProp,
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
  const [nftListings, setNftListings] = useState(() => showNftListings(nftProp))
  const [media, setMedia] = useState<PublicProfileMediaMap>(() =>
    normalizePublicProfileMedia(mediaProp),
  )
  const [stats, setStats] = useState<PersonalPageViewStats>(EMPTY_STATS)
  const [saving, setSaving] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  // Sync from props only when not mid-save (avoids toggle flicker: on → off → on).
  useEffect(() => {
    if (saving) return
    setEnabled(publicProfile)
    setSections(normalizePersonalPageSections(publicProfileSections))
    setFields(normalizePublicProfileFields(publicProfileFields))
    setAcceptDms(acceptsProfileDms(acceptDmsProp))
    setNftListings(showNftListings(nftProp))
    setMedia(normalizePublicProfileMedia(mediaProp))
  }, [
    publicProfile,
    publicProfileSections,
    publicProfileFields,
    acceptDmsProp,
    nftProp,
    mediaProp,
    saving,
  ])

  useEffect(() => {
    if (!username) {
      setStats(EMPTY_STATS)
      return
    }
    let cancelled = false
    void getPersonalPageViewStats(username)
      .then((next) => {
        if (!cancelled) setStats(next)
      })
      .catch(() => {
        if (!cancelled) setStats(EMPTY_STATS)
      })
    return () => {
      cancelled = true
    }
  }, [username])

  const siteHost = typeof window !== 'undefined' ? window.location.host : ''
  const publicPath = username ? `/${username}` : ''
  const publicUrl = username ? `${siteHost}/${username}` : ''
  const shareUrl =
    typeof window !== 'undefined' && username
      ? appendReferralFragment(`${window.location.origin}/${username}`, username)
      : publicUrl
        ? `https://${publicUrl}`
        : ''

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

  const mediaMeta = useMemo(
    () =>
      [
        { id: 'player' as const, label: t('mediaPlayer') || 'Player' },
        { id: 'games' as const, label: t('mediaGames') || 'Games' },
        { id: 'gallery' as const, label: t('mediaGallery') || 'Gallery' },
      ] as const,
    [t],
  )

  const persist = useCallback(
    async (
      nextEnabled: boolean,
      nextSections: string[],
      nextFields: PublicProfileFieldsMap,
      nextAcceptDms: boolean,
      nextNft: boolean,
      nextMedia: PublicProfileMediaMap,
      key?: string,
    ) => {
      setSaving(true)
      if (key) setPendingKey(key)
      try {
        const formData = new FormData()
        formData.append('publicProfile', nextEnabled ? 'true' : 'false')
        formData.append('publicProfileSections', JSON.stringify(nextSections))
        formData.append('publicProfileFields', JSON.stringify(nextFields))
        formData.append('acceptProfileDms', nextAcceptDms ? 'true' : 'false')
        formData.append('publicProfileNftListings', nextNft ? 'true' : 'false')
        formData.append('publicProfileMedia', JSON.stringify(nextMedia))
        const { updateProfile } = await import('@/app/_actions/profile')
        const result = await updateProfile({ success: false, message: '' }, formData)
        if (result.success) {
          onPublicProfileChange?.(
            nextEnabled,
            nextSections,
            nextFields,
            nextAcceptDms,
            nextNft,
            nextMedia,
          )
          startTransition(() => {
            void updateSession().catch(() => undefined)
          })
        } else {
          // Revert local optimistic state from last known props
          setEnabled(publicProfile)
          setSections(normalizePersonalPageSections(publicProfileSections))
          setFields(normalizePublicProfileFields(publicProfileFields))
          setAcceptDms(acceptsProfileDms(acceptDmsProp))
          setNftListings(showNftListings(nftProp))
          setMedia(normalizePublicProfileMedia(mediaProp))
        }
      } finally {
        setSaving(false)
        setPendingKey(null)
      }
    },
    [
      onPublicProfileChange,
      updateSession,
      publicProfile,
      publicProfileSections,
      publicProfileFields,
      acceptDmsProp,
      nftProp,
      mediaProp,
    ],
  )

  const toggleSection = (id: PersonalPageSectionId) => {
    if (!enabled || saving) return
    const has = sections.includes(id)
    const next = has ? sections.filter((x) => x !== id) : [...sections, id]
    const safe = normalizePersonalPageSections(next)
    setSections(safe)
    void persist(enabled, safe, fields, acceptDms, nftListings, media, `section:${id}`)
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
    void persist(
      enabled,
      sections,
      normalized,
      acceptDms,
      nftListings,
      media,
      `field:${section}:${field}`,
    )
  }

  const handleEnabledChange = (next: boolean) => {
    if (saving) return
    if (next && !username) {
      setOpen(false)
      onOpenUsernameModal()
      return
    }
    setEnabled(next)
    void persist(next, sections, fields, acceptDms, nftListings, media, 'master')
  }

  const handleAcceptDmsChange = (next: boolean) => {
    if (saving) return
    setAcceptDms(next)
    void persist(enabled, sections, fields, next, nftListings, media, 'dms')
  }

  const handleNftChange = (next: boolean) => {
    if (saving) return
    setNftListings(next)
    void persist(enabled, sections, fields, acceptDms, next, media, 'nft')
  }

  const handleMediaChange = (id: PersonalPageMediaId, next: boolean) => {
    if (saving) return
    const nextMedia = normalizePublicProfileMedia({ ...media, [id]: next })
    setMedia(nextMedia)
    void persist(enabled, sections, fields, acceptDms, nftListings, nextMedia, `media:${id}`)
  }

  const copyPublicUrl = async () => {
    if (!username) return
    const text =
      typeof window !== 'undefined'
        ? appendReferralFragment(`${window.location.origin}/${username}`, username)
        : `/${username}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const showPrivateHits =
    stats.privateUnique24h > 0 || stats.privateUnique7d > 0 || !enabled

  return (
    <>
      <div
        className={cn(
          davinciGlassSurface,
          'relative flex w-full flex-col gap-3 p-4 text-left',
          className,
        )}
      >
        {saving && pendingKey === 'master' ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/40 backdrop-blur-[2px]"
            aria-busy
          >
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

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
                  'Personal page is off — open Page Builder to configure'}
            </p>
          </div>
          <span
            className={cn(
              'mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              enabled
                ? 'border-green-500/50 text-green-700 dark:text-green-400'
                : 'border-border text-muted-foreground',
            )}
          >
            <StatusDot on={enabled} />
            {enabled ? t('personalPageOn') || 'ON' : t('personalPageOff') || 'OFF'}
          </span>
        </div>

        <div className="pl-[3.25rem]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Construction className="size-3.5" strokeWidth={1.75} />
            {t('pageBuilder') || 'Page Builder'}
          </Button>
        </div>

        {username ? (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                {enabled ? publicUrl || publicPath : publicPath}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void copyPublicUrl()}
                disabled={!username}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied
                  ? t('shareEarnCopied') || 'Copied'
                  : t('shareEarnCopyProfile') || 'Copy link'}
              </Button>
            </div>
            {!enabled ? (
              <p className="text-[11px] text-muted-foreground">
                {t('shareEarnPrivateHint') ||
                  'Link opens a private page — enable Personal page to publish.'}
              </p>
            ) : null}

            {enabled ? (
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
            ) : null}
            {showPrivateHits ? (
              <p className="text-[11px] text-muted-foreground">
                {t('personalPagePrivateHits') || 'Private hits'}{' '}
                <span className="tabular-nums text-foreground">
                  {stats.privateUnique24h}
                  <span className="text-muted-foreground"> / </span>
                  {stats.privateUnique7d}
                </span>
                <span className="text-muted-foreground/80">
                  {' '}
                  ({t('personalPageByRoleHint') || '24h / 7d unique'})
                </span>
              </p>
            ) : null}
            {enabled && (stats.byRole24h.length > 0 || stats.byRole7d.length > 0) ? (
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
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <FsModal
        open={open}
        onOpenChange={setOpen}
        title={t('pageBuilder') || 'Page Builder'}
        description={
          t('pageBuilderDescription') || 'Choose what appears on your public profile'
        }
        hideHeaderSeparator
        className={cn(
          'h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-none',
          'sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-none sm:rounded-none',
          'md:h-[min(100dvh,920px)] md:max-h-[min(100dvh,920px)] md:w-[min(100vw-2rem,72rem)] md:max-w-[72rem] md:rounded-xl',
        )}
        contentClassName="!py-3"
        footer={
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Layout className="mt-0.5 size-3.5 shrink-0" />
            {t('pageBuilderFooterLive') ||
              'Toggle sections and fields. Changes save immediately.'}
          </p>
        }
      >
        <div
          className={cn(
            'relative space-y-4',
            saving && 'pointer-events-none',
          )}
        >
          {saving ? (
            <div className="absolute inset-0 z-10 rounded-lg bg-background/30 backdrop-blur-[1px]" />
          ) : null}

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start">
            <div className="space-y-3">
              <div className="relative flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
                {pendingKey === 'master' && saving ? (
                  <Loader2 className="absolute right-12 size-4 animate-spin text-muted-foreground" />
                ) : null}
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <StatusDot on={enabled} />
                    {t('personalPage') || 'Personal page'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {enabled
                      ? shareUrl.replace(/^https?:\/\//, '') || publicPath
                      : t('personalPagePrivate')}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={saving}
                  onCheckedChange={handleEnabledChange}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
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

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t('sectionNftListings') || 'NFT listings'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('sectionNftListingsHint') ||
                      'Show NFTs for sale on your public personal page'}
                  </p>
                </div>
                <Switch
                  checked={nftListings}
                  disabled={saving}
                  onCheckedChange={handleNftChange}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/50 px-3 py-2.5">
                <p className="text-sm font-medium">{t('mediaSurfaces') || 'Media surfaces'}</p>
                <p className="text-xs text-muted-foreground">
                  {t('mediaSurfacesHint') ||
                    'Pin visibility independently of the personal page master switch'}
                </p>
                <ul className="space-y-2 pt-1">
                  {mediaMeta.map((row) => {
                    const effective = personalPageMediaVisible(media, row.id, enabled)
                    return (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>{row.label}</span>
                        <Switch
                          checked={effective}
                          disabled={saving}
                          onCheckedChange={(next) => handleMediaChange(row.id, next)}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
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
          </div>

          {!username ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false)
                onOpenUsernameModal()
              }}
            >
              {t('setUsernameFirst') || 'Set a username first'}
            </Button>
          ) : null}
        </div>
      </FsModal>
    </>
  )
}

export default PersonalPageWidget
