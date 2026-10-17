'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CURTAIN_HEIGHT_VH } from '@/features/curtain/constants'
import type { CurtainDropParams } from '@/features/curtain/types'

export function CurtainBanner({
  offer,
  nextOffer,
  visible,
  swipeHint,
  onCta,
  onDesktopDismiss,
  onSwipe,
}: {
  offer: CurtainDropParams
  nextOffer?: CurtainDropParams | null
  visible: boolean
  swipeHint?: 'not_today' | 'not_for_me' | null
  onCta: () => void
  onDesktopDismiss: () => void
  onSwipe: (direction: 'left' | 'right') => void
}) {
  const t = useTranslations('modules.curtain')
  const height = `${offer.heightVh || CURTAIN_HEIGHT_VH}vh`
  const dragX = useMotionValue(0)
  const opacity = useTransform(dragX, [-160, 0, 160], [0.25, 1, 0.25])

  useEffect(() => {
    dragX.set(0)
  }, [dragX, offer.offerId])

  return (
    <div
      className="fixed inset-x-0 top-0 z-[48]"
      style={{ height, minHeight: '4.5rem' }}
    >
      {nextOffer ? (
        <div
          className={cn(
            'absolute inset-0 flex items-center border-b bg-muted/90 px-3 text-sm font-medium',
            nextOffer.bgStyle,
          )}
        >
          <span className="truncate">
            {nextOffer.line1.text || nextOffer.productName || t('bannerLabel')}
          </span>
        </div>
      ) : null}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        style={{ x: dragX, opacity }}
        initial={{ y: '-120%' }}
        animate={{ y: visible ? 0 : '-120%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.9 }}
        className={cn(
          'absolute inset-0 flex items-stretch overflow-hidden border-b bg-background/95 shadow-md backdrop-blur',
          offer.bgStyle,
        )}
        onDragEnd={(_, info) => {
          if (info.offset.x > 72) onSwipe('right')
          else if (info.offset.x < -72) onSwipe('left')
          else dragX.set(0)
        }}
        role="dialog"
        aria-label={offer.line1.text || t('bannerLabel')}
      >
        <BannerBody
          offer={offer}
          swipeHint={swipeHint}
          onCta={onCta}
          onDesktopDismiss={onDesktopDismiss}
        />
      </motion.div>
    </div>
  )
}

function BannerBody({
  offer,
  swipeHint,
  onCta,
  onDesktopDismiss,
}: {
  offer: CurtainDropParams
  swipeHint?: 'not_today' | 'not_for_me' | null
  onCta: () => void
  onDesktopDismiss: () => void
}) {
  const t = useTranslations('modules.curtain')

  return (
    <div className="relative flex h-full w-full items-stretch">
      {offer.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={offer.mediaUrl} alt="" className="h-full w-auto max-w-[22%] object-cover" />
      ) : (
        <div className="h-full aspect-square bg-muted" />
      )}
      <button
        type="button"
        className="hidden md:flex items-center px-2 text-muted-foreground hover:text-foreground"
        aria-label={t('dismiss')}
        onClick={onDesktopDismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1">
        <p className={cn('truncate text-sm font-semibold', offer.line1.className)}>
          {offer.line1.text || (offer.kind === 'a2hs' ? t('a2hsLine1') : offer.productName)}
        </p>
        <p className={cn('truncate text-xs text-muted-foreground', offer.line2?.className)}>
          {offer.line2?.text || (offer.kind === 'a2hs' ? t('a2hsLine2') : t('productLine2'))}
        </p>
        {swipeHint ? (
          <p className="text-[11px] text-muted-foreground/80">
            {swipeHint === 'not_today' ? t('notToday') : t('notForMe')}
          </p>
        ) : null}
      </div>
      <div className="flex items-center pr-3">
        <Button type="button" size="sm" className={cn('shrink-0', offer.ctaStyle)} onClick={onCta}>
          {offer.ctaText || (offer.kind === 'a2hs' ? t('a2hsCta') : t('productCta'))}
        </Button>
      </div>
    </div>
  )
}
