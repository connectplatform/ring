'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { updateAdminStorePromotionsAction } from '@/app/_actions/admin-store-erp'
import { formatPromotionBadge, type ProductPromotion, type StorePromoCode } from '@/features/store/types/promotions'
import type { StorePromotionsSettings } from '@/features/store/types/store-settings'
import type { Locale } from '@/i18n/shared'

export function StorePromotionsEditor({
  initial,
  promotedProducts,
  locale = 'en',
  isPlatformAdmin = true,
}: {
  initial: StorePromotionsSettings
  promotedProducts: Array<{ id: string; name: string; promotions: unknown }>
  locale?: Locale
  isPlatformAdmin?: boolean
}) {
  const t = useTranslations('modules.admin.storeHub')
  const [promotions, setPromotions] = useState<StorePromotionsSettings>(initial)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const save = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const saved = await updateAdminStorePromotionsAction({
          ...promotions,
          promoCodes: promotions.promoCodes.filter((code) => code.code.trim()),
        })
        setPromotions(saved)
        setMessage(t('saved'))
      } catch {
        setMessage(t('saveFailed'))
      }
    })
  }

  const updateCode = (id: string, patch: Partial<StorePromoCode>) => {
    setPromotions((current) => ({
      ...current,
      promoCodes: current.promoCodes.map((code) => (code.id === id ? { ...code, ...patch } : code)),
    }))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('promotionsTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('promotionsHint')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('promoCodes')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPromotions((current) => ({
                ...current,
                promoCodes: [
                  ...current.promoCodes,
                  {
                    id: `promo_${Date.now()}`,
                    code: '',
                    discountType: 'percent',
                    value: 10,
                    minOrderAmount: 0,
                    enabled: true,
                  },
                ],
              }))
            }
          >
            {t('addCode')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {promotions.promoCodes.map((code) => (
            <div key={code.id} className="grid gap-3 border border-border rounded-lg p-3 sm:grid-cols-6">
              <div className="space-y-1 sm:col-span-2">
                <Label>{t('code')}</Label>
                <Input value={code.code} onChange={(event) => updateCode(code.id, { code: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{t('discountType')}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={code.discountType}
                  onChange={(event) =>
                    updateCode(code.id, {
                      discountType: event.target.value === 'fixed' ? 'fixed' : 'percent',
                    })
                  }
                >
                  <option value="percent">{t('percent')}</option>
                  <option value="fixed">{t('fixed')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('value')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={code.value}
                  onChange={(event) => updateCode(code.id, { value: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('minOrder')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={code.minOrderAmount ?? 0}
                  onChange={(event) => updateCode(code.id, { minOrderAmount: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('startsAt')}</Label>
                <Input
                  type="date"
                  value={code.startsAt?.slice(0, 10) || ''}
                  onChange={(event) => updateCode(code.id, { startsAt: event.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('endsAt')}</Label>
                <Input
                  type="date"
                  value={code.endsAt?.slice(0, 10) || ''}
                  onChange={(event) => updateCode(code.id, { endsAt: event.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('maxRedemptions')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={t('unlimited')}
                  value={code.maxRedemptions ?? ''}
                  onChange={(event) =>
                    updateCode(code.id, {
                      maxRedemptions: event.target.value === '' ? undefined : Number(event.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-end text-xs text-muted-foreground pb-2">
                {t('redemptionsUsed')}: {code.redemptionCount ?? 0} / {code.maxRedemptions || '∞'}
              </div>
              <div className="flex items-end justify-between gap-2">
                <label className="flex items-center gap-2 text-sm pb-2">
                  <input
                    type="checkbox"
                    checked={code.enabled}
                    onChange={(event) => updateCode(code.id, { enabled: event.target.checked })}
                  />
                  {t('enabled')}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPromotions((current) => ({
                      ...current,
                      promoCodes: current.promoCodes.filter((row) => row.id !== code.id),
                    }))
                  }
                >
                  {t('remove')}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('freeShipping')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fs-mode">{t('freeShippingMode')}</Label>
            <select
              id="fs-mode"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={promotions.freeShipping.mode}
              onChange={(event) =>
                setPromotions((current) => ({
                  ...current,
                  freeShipping: {
                    ...current.freeShipping,
                    mode:
                      event.target.value === 'always' || event.target.value === 'conditional'
                        ? event.target.value
                        : 'off',
                  },
                }))
              }
            >
              <option value="off">{t('freeShippingOff')}</option>
              <option value="always">{t('freeShippingAlways')}</option>
              <option value="conditional">{t('freeShippingConditional')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fs-min">{t('minOrder')}</Label>
            <Input
              id="fs-min"
              type="number"
              min={0}
              value={promotions.freeShipping.minOrderAmount ?? 0}
              onChange={(event) =>
                setPromotions((current) => ({
                  ...current,
                  freeShipping: {
                    ...current.freeShipping,
                    minOrderAmount: Number(event.target.value) || 0,
                  },
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(promotions.checkoutSpecialOfferEnabled)}
              onChange={(event) =>
                setPromotions((current) => ({
                  ...current,
                  checkoutSpecialOfferEnabled: event.target.checked,
                }))
              }
            />
            {t('specialOffer')}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('productPromotions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {promotedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noProductPromotions')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {promotedProducts.map((product) => {
                const promos = Array.isArray(product.promotions)
                  ? (product.promotions as ProductPromotion[])
                  : []
                const editHref = isPlatformAdmin
                  ? ROUTES.ADMIN_STORE_PRODUCTS_EDIT(product.id, locale)
                  : ROUTES.VENDOR_PRODUCTS_EDIT(locale, product.id)
                return (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2"
                  >
                    <Link href={editHref} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {promos.map((p) => formatPromotionBadge(p)).join(', ') || promos.length}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  )
}
