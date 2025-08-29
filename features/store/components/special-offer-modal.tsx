'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SlidingPopup } from '@/components/common/widgets/modal'
import { cn } from '@/lib/utils'

type Currency = 'RING' | 'DAAR' | 'DAARION' | 'UAH' | 'USD' | 'EUR'

export interface SpecialOffer {
  id: string
  title: string
  description?: string
  imageUrl?: string
  /** Price to show inside the offer card */
  price?: number
  currency?: Currency
  /** Optional original price to display discount */
  compareAtPrice?: number
  /** When the offer expires. If omitted, no countdown is shown. */
  expiresAt?: string | number | Date
  /** CTA button text */
  ctaText?: string
  /** Where the CTA navigates to. If onClick provided, it takes precedence */
  href?: string
  /** Custom handler for CTA click */
  onClick?: () => void
}

export interface SpecialOfferModalProps {
  offer: SpecialOffer
  /** Controls visibility. If not provided, the component manages its own visibility based on `autoOpen` */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Auto opens on mount after `autoOpenDelayMs` (default 1000) */
  autoOpen?: boolean
  autoOpenDelayMs?: number
  /** If true, displays as a bottom-left floating popup; otherwise uses centered dialog */
  floating?: boolean
  /** Optional className to tweak styles */
  className?: string
}

function formatTime(msRemaining: number) {
  if (msRemaining <= 0) return { h: '00', m: '00', s: '00' }
  const totalSeconds = Math.floor(msRemaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { h: pad(hours), m: pad(minutes), s: pad(seconds) }
}

export function SpecialOfferModal({
  offer,
  open,
  onOpenChange,
  autoOpen = true,
  autoOpenDelayMs = 1000,
  floating = true,
  className
}: SpecialOfferModalProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(Boolean(open))
  const isControlled = typeof open === 'boolean'
  const visible = isControlled ? Boolean(open) : internalOpen

  // Auto open on mount
  useEffect(() => {
    if (!isControlled && autoOpen && !internalOpen) {
      const t = setTimeout(() => setInternalOpen(true), autoOpenDelayMs)
      return () => clearTimeout(t)
    }
  }, [autoOpen, autoOpenDelayMs, internalOpen, isControlled])

  // Countdown
  const expiresDate = useMemo(() =>
    offer.expiresAt ? new Date(offer.expiresAt) : null,
  [offer.expiresAt])
  const [now, setNow] = useState<number>(Date.now())
  useEffect(() => {
    if (!expiresDate) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresDate])
  const msRemaining = expiresDate ? Math.max(0, expiresDate.getTime() - now) : 0
  const time = expiresDate ? formatTime(msRemaining) : null

  const close = () => {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setInternalOpen(false)
    }
  }

  const content = (
    <div className={cn('flex w-full gap-4', className)}>
      {offer.imageUrl && (
        <div className="relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-md sm:block">
          <Image src={offer.imageUrl} alt={offer.title} fill className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Special Offer</div>
        <div className="text-base font-semibold leading-tight sm:text-lg">{offer.title}</div>
        {offer.description && (
          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{offer.description}</div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {typeof offer.price === 'number' && (
            <div className="flex items-baseline gap-2">
              {typeof offer.compareAtPrice === 'number' && offer.compareAtPrice > (offer.price ?? 0) && (
                <span className="text-sm text-muted-foreground line-through">{offer.compareAtPrice} {offer.currency || 'UAH'}</span>
              )}
              <span className="text-lg font-bold">{offer.price} {offer.currency || 'UAH'}</span>
            </div>
          )}
          {time && (
            <div className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {time.h}:{time.m}:{time.s}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {offer.onClick ? (
            <Button onClick={offer.onClick}>{offer.ctaText || 'View Deal'}</Button>
          ) : offer.href ? (
            <Button asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href={offer.href}>{offer.ctaText || 'View Deal'}</a>
            </Button>
          ) : null}
          <Button variant="ghost" onClick={close}>Dismiss</Button>
        </div>
      </div>
    </div>
  )

  if (floating) {
    return (
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 w-[92vw] max-w-[380px] sm:bottom-6 sm:left-6">
        <SlidingPopup
          isOpen={visible}
          onCloseAction={async () => close()}
        >
          <div className="pointer-events-auto rounded-md border bg-background p-4 shadow-xl">
            {content}
          </div>
        </SlidingPopup>
      </div>
    )
  }

  return (
    <Dialog open={visible} onOpenChange={(o) => (isControlled ? onOpenChange?.(o) : setInternalOpen(o))}>
      <DialogContent className="sm:max-w-[520px]">
        {content}
      </DialogContent>
    </Dialog>
  )
}

export default SpecialOfferModal


