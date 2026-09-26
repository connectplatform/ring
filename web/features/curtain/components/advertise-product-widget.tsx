'use client'

import { useTranslations } from 'next-intl'
import { Megaphone } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  CURTAIN_COMMISSION_DEFAULT,
  CURTAIN_COMMISSION_MAX,
  CURTAIN_COMMISSION_MIN,
} from '@/features/curtain/constants'
import { clampCurtainCommission } from '@/features/curtain/lib/advertise'
import type { CurtainAdvertiseConfig } from '@/features/curtain/types'

export function AdvertiseProductWidget({
  value,
  onChange,
  hasPrice,
  expectedFeeLabel,
  disabled,
}: {
  value: CurtainAdvertiseConfig
  onChange: (next: CurtainAdvertiseConfig) => void
  hasPrice: boolean
  expectedFeeLabel?: string
  disabled?: boolean
}) {
  const t = useTranslations('modules.curtain')
  const blocked = disabled || !hasPrice
  const percent = clampCurtainCommission(value.commissionPercent || CURTAIN_COMMISSION_DEFAULT)

  return (
    <div className="space-y-3 pt-4 border-t">
      <input type="hidden" name="curtainAdvertiseJson" value={JSON.stringify({ ...value, commissionPercent: percent })} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <Label className="text-sm font-medium">{t('advertiseTitle')}</Label>
            <p className="text-xs text-muted-foreground">
              {hasPrice ? t('advertiseHint') : t('advertiseNeedsPrice')}
            </p>
          </div>
        </div>
        <Switch
          checked={Boolean(value.enabled) && hasPrice}
          disabled={blocked}
          onCheckedChange={(enabled) => onChange({ ...value, enabled: Boolean(enabled) && hasPrice })}
        />
      </div>
      {value.enabled && hasPrice ? (
        <div className="space-y-2 pl-6">
          <div className="flex items-center justify-between text-sm">
            <span>{t('commissionLabel')}</span>
            <span className="font-medium tabular-nums">{percent}%</span>
          </div>
          <Slider
            min={CURTAIN_COMMISSION_MIN}
            max={CURTAIN_COMMISSION_MAX}
            step={1}
            value={[percent]}
            disabled={blocked}
            onValueChange={(vals) =>
              onChange({ ...value, commissionPercent: clampCurtainCommission(vals[0] ?? percent) })
            }
          />
          {expectedFeeLabel ? (
            <p className="text-xs text-muted-foreground">{expectedFeeLabel}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('commissionHint', { percent })}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
