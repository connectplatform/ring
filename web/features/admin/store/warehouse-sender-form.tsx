'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveWarehouseSenderAction } from '@/app/_actions/admin-store-erp'
import { NovaPostSelector, type NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'

export function WarehouseSenderForm({
  warehouseId,
  initial,
}: {
  warehouseId: string
  initial?: { id?: string; name?: string; address?: string; senderPhone?: string; canShip?: boolean }
}) {
  const t = useTranslations('modules.admin.storeHub')
  const [location, setLocation] = useState<NovaPostLocation | null>(
    initial?.id
      ? { id: initial.id, name: initial.name || '', address: initial.address || '' }
      : null,
  )
  const [senderPhone, setSenderPhone] = useState(initial?.senderPhone || '')
  const [canShip, setCanShip] = useState(initial?.canShip === true)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="space-y-3 max-w-xl">
      <h2 className="text-lg font-medium">{t('senderBranch')}</h2>
      <p className="text-sm text-muted-foreground">{t('senderBranchHint')}</p>
      <NovaPostSelector selected={location} onSelect={setLocation} />
      <div className="space-y-1">
        <Label htmlFor="sender-phone">{t('senderPhone')}</Label>
        <Input
          id="sender-phone"
          value={senderPhone}
          onChange={(event) => setSenderPhone(event.target.value)}
          autoComplete="tel"
        />
        <p className="text-sm text-muted-foreground">{t('senderPhoneHint')}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={canShip}
          onChange={(event) => setCanShip(event.target.checked)}
        />
        {t('canShip')}
      </label>
      <p className="text-sm text-muted-foreground">{t('canShipHint')}</p>
      <Button
        type="button"
        disabled={pending || !location?.id}
        onClick={() =>
          startTransition(async () => {
            if (!location?.id) return
            try {
              await saveWarehouseSenderAction({
                warehouseId,
                novaPostSenderDivisionId: location.id,
                novaPostSenderDivisionName: location.name,
                novaPostSenderAddress: location.address,
                senderPhone,
                canShip,
              })
              setMessage(t('saved'))
            } catch {
              setMessage(t('saveFailed'))
            }
          })
        }
      >
        {pending ? t('saving') : t('save')}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
