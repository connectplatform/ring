'use client'

/**
 * User-segment onboarding gate — fullscreen fs-modal queue.
 *
 * Shows one dedicated screen per missing profile-data segment, in registry
 * order. "Maybe later" snoozes a segment for 7 days (localStorage); saving is
 * authoritative server-side, so a completed segment never returns.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FsModal } from '@/components/ui/fs-modal'
import { Button } from '@/components/ui/button'
import { ONBOARDING_SEGMENTS, ONBOARDING_SNOOZE_MS } from '../segments'
import type { OnboardingSegmentId } from '../types'
import { DateOfBirthScreen } from './screens/date-of-birth-screen'
import type { Locale } from '@/i18n/shared'

function readSnoozed(): Set<OnboardingSegmentId> {
  if (typeof window === 'undefined') return new Set()
  const now = Date.now()
  const snoozed = new Set<OnboardingSegmentId>()
  for (const def of Object.values(ONBOARDING_SEGMENTS)) {
    try {
      const raw = window.localStorage.getItem(def.snoozeKey)
      if (raw && now - Number(raw) < ONBOARDING_SNOOZE_MS) snoozed.add(def.id)
    } catch {
      /* storage unavailable — show the segment */
    }
  }
  return snoozed
}

/** Fire-and-forget funnel telemetry — never blocks or breaks the gate UX. */
function trackFunnel(event: 'shown' | 'completed' | 'snoozed', segmentId: OnboardingSegmentId) {
  try {
    void fetch('/api/analytics/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, segmentId }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* telemetry is best-effort */
  }
}

export function UserOnboardingGate({
  pendingSegments,
  locale,
}: {
  pendingSegments: OnboardingSegmentId[]
  locale: Locale
}) {
  const t = useTranslations('modules.onboarding')
  const router = useRouter()
  const [queue, setQueue] = useState<OnboardingSegmentId[]>([])
  const [ready, setReady] = useState(false)

  // Hydrate snoozes after mount (localStorage is client-only) to avoid SSR mismatch.
  useEffect(() => {
    const snoozed = readSnoozed()
    setQueue(pendingSegments.filter((id) => !snoozed.has(id)))
    setReady(true)
  }, [pendingSegments])

  const current = queue[0] ?? null
  const shownRef = useRef<Set<OnboardingSegmentId>>(new Set())

  // Funnel: fire `shown` once per segment per mount, after hydration.
  useEffect(() => {
    if (!current || shownRef.current.has(current)) return
    shownRef.current.add(current)
    trackFunnel('shown', current)
  }, [current])

  const complete = useCallback(() => {
    if (current) trackFunnel('completed', current)
    setQueue((prev) => prev.slice(1))
    // Server truth (users.birthDate) now set — refresh server components.
    router.refresh()
  }, [current, router])

  const snooze = useCallback(
    (id: OnboardingSegmentId) => {
      trackFunnel('snoozed', id)
      const def = ONBOARDING_SEGMENTS[id]
      try {
        window.localStorage.setItem(def.snoozeKey, String(Date.now()))
      } catch {
        /* storage unavailable — session-only snooze */
      }
      setQueue((prev) => prev.filter((s) => s !== id))
    },
    [],
  )

  const footer = useMemo(() => {
    if (!current) return null
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => snooze(current)}
      >
        {t('maybeLater')}
      </Button>
    )
  }, [current, snooze, t])

  if (!ready || !current) return null

  const def = ONBOARDING_SEGMENTS[current]

  return (
    <FsModal
      open
      onOpenChange={(o) => {
        if (!o) snooze(current)
      }}
      title={t(def.titleKey)}
      description={t(def.descriptionKey)}
      footer={footer}
    >
      {current === 'date-of-birth' ? <DateOfBirthScreen onComplete={complete} /> : null}
    </FsModal>
  )
}
