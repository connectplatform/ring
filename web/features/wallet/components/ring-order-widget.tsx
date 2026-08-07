'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RingOrderWidgetProps {
  orderId: string
  locale: Locale
  className?: string
}

type OrderStatus = 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled'

export default function RingOrderWidget({ orderId, locale, className }: RingOrderWidgetProps) {
  const t = useTranslations('modules.wallet')
  const [status, setStatus] = useState<OrderStatus | null>(null)

  const shortId = orderId.length > 8 ? `${orderId.slice(0, 8)}…` : orderId

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/store/orders/${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && data?.status) {
          setStatus(data.status as OrderStatus)
        }
      } catch {
        /* optional enrichment */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId])

  return (
    <Link
      href={ROUTES.STORE_ORDER_DETAILS(locale, orderId)}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-primary hover:underline',
        className
      )}
    >
      <Package className="h-3.5 w-3.5 shrink-0" />
      <span>{t('orderLabel', { id: shortId, defaultValue: `Order #${shortId}` })}</span>
      {status && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 capitalize">
          {status}
        </Badge>
      )}
    </Link>
  )
}
