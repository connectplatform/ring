'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'

export default function CartClient({ locale }: { locale: Locale }) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalPriceByCurrency } = useStore()
  const [clearing, setClearing] = useState(false)
  const t = useTranslations('modules.store.cart')
  const tCommon = useTranslations('common.actions')

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t('title')}</h1>
      {cartItems.length === 0 ? (
        <div className="text-muted-foreground">{t('empty')}</div>
      ) : (
        <div className="space-y-4">
          {cartItems.map(i => (
            <div key={i.product.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.product.name}</div>
                <div className="text-sm">{i.quantity} × {i.product.price} {i.product.currency}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded" onClick={() => updateQuantity(i.product.id, i.quantity - 1)}>-</button>
                <span className="w-6 text-center">{i.quantity}</span>
                <button className="px-2 py-1 border rounded" onClick={() => updateQuantity(i.product.id, i.quantity + 1)}>+</button>
                <button onClick={() => removeFromCart(i.product.id)} className="underline text-sm ml-3">{tCommon('remove')}</button>
              </div>
            </div>
          ))}
          <div className="text-sm">{t('total')}: {totalPriceByCurrency.DAAR || 0} DAAR{(totalPriceByCurrency.DAAR && totalPriceByCurrency.DAARION) ? ' + ' : ''}{totalPriceByCurrency.DAARION || 0} DAARION</div>
          <div className="flex gap-3">
            <button className="underline" onClick={async () => { if (clearing) return; setClearing(true); try { clearCart() } finally { setClearing(false) } }} aria-busy={clearing}>
              {clearing ? t('clearing') : t('clear')}
            </button>
            <Link className="underline" href={ROUTES.CHECKOUT(locale)}>{t('goToCheckout')}</Link>
          </div>
        </div>
      )}
    </div>
  )
}


