'use client'

/**
 * Per-product promotions editor (BOGO / percent off / amount off).
 * Persists via hidden `promotionsJson` FormData field on product CRUD.
 */

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductPromotion, ProductPromotionType } from '@/features/store/types/promotions'

const TYPES: ProductPromotionType[] = ['bogo', 'percent_off', 'amount_off']

function newPromo(type: ProductPromotionType = 'bogo'): ProductPromotion {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `promo_${Date.now()}`,
    type,
    enabled: true,
    label: type === 'bogo' ? 'Buy 2 get 1 free' : undefined,
    buyQty: type === 'bogo' ? 2 : undefined,
    getQty: type === 'bogo' ? 1 : undefined,
    percentOff: type === 'percent_off' ? 10 : undefined,
    amountOff: type === 'amount_off' ? 5 : undefined,
  }
}

interface ProductPromotionsFieldsProps {
  initial?: ProductPromotion[]
  disabled?: boolean
}

export function ProductPromotionsFields({ initial = [], disabled }: ProductPromotionsFieldsProps) {
  const t = useTranslations('vendor.products.form')
  const [promos, setPromos] = useState<ProductPromotion[]>(initial)

  const update = (id: string, patch: Partial<ProductPromotion>) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  return (
    <div className="space-y-3 pt-4 border-t">
      <input type="hidden" name="promotionsJson" value={JSON.stringify(promos)} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">
            {t('promotionsTitle', { defaultValue: 'Product promotions' })}
          </Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setPromos((prev) => [...prev, newPromo()])}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t('addPromotion', { defaultValue: 'Add promotion' })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('promotionsHint', {
          defaultValue: 'Buy-two-get-one, percent off, or fixed amount off — applied at cart/checkout.',
        })}
      </p>

      {promos.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          {t('noPromotions', { defaultValue: 'No promotions on this product.' })}
        </p>
      )}

      {promos.map((promo) => (
        <div
          key={promo.id}
          className="rounded-md border border-border/60 p-3 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={promo.enabled}
                disabled={disabled}
                onCheckedChange={(v) => update(promo.id, { enabled: Boolean(v) })}
              />
              <Select
                value={promo.type}
                disabled={disabled}
                onValueChange={(v) =>
                  update(promo.id, {
                    type: v as ProductPromotionType,
                    buyQty: v === 'bogo' ? promo.buyQty ?? 2 : undefined,
                    getQty: v === 'bogo' ? promo.getQty ?? 1 : undefined,
                    percentOff: v === 'percent_off' ? promo.percentOff ?? 10 : undefined,
                    amountOff: v === 'amount_off' ? promo.amountOff ?? 5 : undefined,
                  })
                }
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === 'bogo'
                        ? t('promoBogo', { defaultValue: 'Buy X get Y free' })
                        : type === 'percent_off'
                          ? t('promoPercent', { defaultValue: 'Percent off' })
                          : t('promoAmount', { defaultValue: 'Amount off' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setPromos((prev) => prev.filter((p) => p.id !== promo.id))}
              aria-label={t('removePromotion', { defaultValue: 'Remove promotion' })}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <Input
            placeholder={t('promoLabel', { defaultValue: 'Label (optional)' })}
            value={promo.label || ''}
            disabled={disabled}
            onChange={(e) => update(promo.id, { label: e.target.value })}
            className="h-8"
          />

          {promo.type === 'bogo' && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t('buyQty', { defaultValue: 'Buy qty' })}</Label>
                <Input
                  type="number"
                  min={1}
                  value={promo.buyQty ?? 2}
                  disabled={disabled}
                  onChange={(e) => update(promo.id, { buyQty: parseInt(e.target.value, 10) || 2 })}
                  className="h-8"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t('getQty', { defaultValue: 'Get free' })}</Label>
                <Input
                  type="number"
                  min={1}
                  value={promo.getQty ?? 1}
                  disabled={disabled}
                  onChange={(e) => update(promo.id, { getQty: parseInt(e.target.value, 10) || 1 })}
                  className="h-8"
                />
              </div>
            </div>
          )}

          {promo.type === 'percent_off' && (
            <div className="space-y-1">
              <Label className="text-xs">{t('percentOff', { defaultValue: '% off' })}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={promo.percentOff ?? 10}
                disabled={disabled}
                onChange={(e) =>
                  update(promo.id, { percentOff: parseFloat(e.target.value) || 0 })
                }
                className="h-8"
              />
            </div>
          )}

          {promo.type === 'amount_off' && (
            <div className="space-y-1">
              <Label className="text-xs">{t('amountOff', { defaultValue: 'Amount off / unit' })}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={promo.amountOff ?? 0}
                disabled={disabled}
                onChange={(e) =>
                  update(promo.id, { amountOff: parseFloat(e.target.value) || 0 })
                }
                className="h-8"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
