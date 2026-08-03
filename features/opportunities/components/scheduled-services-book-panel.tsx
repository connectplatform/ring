'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarClock, Loader2 } from 'lucide-react'
import type { SerializedOpportunity } from '@/features/opportunities/types'
import { asScheduledServicesMetadata } from '@/features/opportunities/types/type-metadata'

interface ScheduledServicesBookPanelProps {
  opportunity: SerializedOpportunity & { metadata?: unknown }
  alreadyRequested: boolean
  onBooked: () => void
}

export function ScheduledServicesBookPanel({
  opportunity,
  alreadyRequested,
  onBooked,
}: ScheduledServicesBookPanelProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session } = useSession()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const meta = asScheduledServicesMetadata(opportunity.metadata) || {}
  const windows = Array.isArray(meta.availability) ? meta.availability : []
  const holdOnly = meta.bookingMode === 'hold'

  const book = () => {
    if (!session?.user?.id || holdOnly) return
    setError(null)
    const slot = windows[selectedIndex]
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/opportunities/${opportunity.id}/scheduled-services/book`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotStart: slot?.start,
              slotEnd: slot?.end,
            }),
          },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || t('scheduledServices.bookFailed'))
        onBooked()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('scheduledServices.bookFailed'))
      }
    })
  }

  return (
    <div className="mb-6 rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          {t('scheduledServices.title')}
        </h3>
        {meta.serviceCategory ? (
          <Badge variant="outline">{meta.serviceCategory}</Badge>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {t('scheduledServices.summary', {
          duration: meta.durationMinutes ?? '—',
          price: meta.pricePerSlot ?? '—',
          mode: meta.bookingMode === 'hold' ? t('scheduledServices.modeHold') : t('scheduledServices.modeInterest'),
        })}
      </p>

      {windows.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {windows.map((w, i) => (
            <button
              key={`${w.start}-${w.end}-${i}`}
              type="button"
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                selectedIndex === i ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
              }`}
              onClick={() => setSelectedIndex(i)}
            >
              <div className="font-medium">
                {new Date(w.start).toLocaleString()} → {new Date(w.end).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">{w.timezone}</div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">{t('scheduledServices.noSlots')}</p>
      )}

      {session?.user ? (
        <Button disabled={pending || alreadyRequested || holdOnly} onClick={book}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {holdOnly
            ? t('scheduledServices.holdDeferred')
            : alreadyRequested
              ? t('scheduledServices.requested')
              : t('scheduledServices.book')}
        </Button>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
