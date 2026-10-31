'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateAdminStoreShippingSettingsAction } from '@/app/_actions/admin-store-erp'
import type { StoreSettingsData, StoreShippingSettings } from '@/features/store/types/store-settings'

export function StoreSettingsEditor({
  initial,
  novaPostKeyConfigured,
}: {
  initial: StoreSettingsData
  novaPostKeyConfigured: boolean
}) {
  const t = useTranslations('modules.admin.storeHub')
  const [shipping, setShipping] = useState<StoreShippingSettings>(initial.shipping)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const save = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        await updateAdminStoreShippingSettingsAction(shipping)
        setMessage(t('saved'))
      } catch {
        setMessage(t('saveFailed'))
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('settingsTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settingsHint')}</p>
      </div>

      {!novaPostKeyConfigured ? (
        <p className="text-sm text-amber-600">{t('novaPostKeyMissing')}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('novaPost')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={shipping.novaPost.enabled}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  novaPost: { ...current.novaPost, enabled: event.target.checked },
                }))
              }
            />
            {t('enabled')}
          </label>
          <div className="space-y-2">
            <Label htmlFor="np-price">{t('price')}</Label>
            <Input
              id="np-price"
              type="number"
              min={0}
              value={shipping.novaPost.price}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  novaPost: { ...current.novaPost, price: Number(event.target.value) || 0 },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-eta">{t('etaDays')}</Label>
            <Input
              id="np-eta"
              value={shipping.novaPost.estimatedDays}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  novaPost: { ...current.novaPost, estimatedDays: event.target.value },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('storePickup')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={shipping.pickup.enabled}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  pickup: { ...current.pickup, enabled: event.target.checked },
                }))
              }
            />
            {t('enabled')}
          </label>
          <div className="space-y-2">
            <Label htmlFor="pu-price">{t('price')}</Label>
            <Input
              id="pu-price"
              type="number"
              min={0}
              value={shipping.pickup.price}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  pickup: { ...current.pickup, price: Number(event.target.value) || 0 },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pu-eta">{t('etaDays')}</Label>
            <Input
              id="pu-eta"
              value={shipping.pickup.estimatedDays}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  pickup: { ...current.pickup, estimatedDays: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pu-address">{t('address')}</Label>
            <Input
              id="pu-address"
              value={shipping.pickup.address || ''}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  pickup: { ...current.pickup, address: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pu-hours">{t('hours')}</Label>
            <Input
              id="pu-hours"
              value={shipping.pickup.hours || ''}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  pickup: { ...current.pickup, hours: event.target.value },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 max-w-xs">
        <Label htmlFor="default-method">{t('defaultMethod')}</Label>
        <select
          id="default-method"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={shipping.defaultMethod}
          onChange={(event) =>
            setShipping((current) => ({
              ...current,
              defaultMethod: event.target.value === 'pickup' ? 'pickup' : 'nova-post',
            }))
          }
        >
          <option value="nova-post">{t('novaPost')}</option>
          <option value="pickup">{t('storePickup')}</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  )
}
