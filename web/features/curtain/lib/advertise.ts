import {
  CURTAIN_COMMISSION_DEFAULT,
  CURTAIN_COMMISSION_MAX,
  CURTAIN_COMMISSION_MIN,
} from '@/features/curtain/constants'
import type { CurtainAdvertiseConfig } from '@/features/curtain/types'

export function clampCurtainCommission(value: number): number {
  if (!Number.isFinite(value)) return CURTAIN_COMMISSION_DEFAULT
  return Math.min(CURTAIN_COMMISSION_MAX, Math.max(CURTAIN_COMMISSION_MIN, Math.round(value)))
}

/** Mint path: 0% means skip. Do not bump to the 1% floor. */
export function commissionPercentForMint(value: number): number | null {
  if (!Number.isFinite(value) || value < CURTAIN_COMMISSION_MIN) return null
  return clampCurtainCommission(value)
}

export function curtainAdvertiseWriteFields(
  formData: FormData,
): { curtainAdvertise: CurtainAdvertiseConfig; curtainAdvertiseEnabled: boolean } | Record<string, never> {
  const cfg = parseCurtainAdvertiseFromForm(formData)
  if (!cfg) return {}
  return {
    curtainAdvertise: cfg,
    curtainAdvertiseEnabled: cfg.enabled,
  }
}

export function parseCurtainAdvertise(raw: unknown): CurtainAdvertiseConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const enabled = Boolean(rec.enabled)
  const percent = clampCurtainCommission(Number(rec.commissionPercent ?? rec.percent))
  return { enabled, commissionPercent: percent }
}

export function parseCurtainAdvertiseFromForm(formData: FormData): CurtainAdvertiseConfig | null {
  const json = String(formData.get('curtainAdvertiseJson') || '').trim()
  if (json) {
    try {
      return parseCurtainAdvertise(JSON.parse(json))
    } catch {
      /* fall through */
    }
  }
  const enabledRaw = formData.get('curtainAdvertiseEnabled')
  if (enabledRaw == null) return null
  const enabled = enabledRaw === 'true' || enabledRaw === 'on' || enabledRaw === '1'
  const percent = clampCurtainCommission(Number(formData.get('curtainCommissionPercent')))
  return { enabled, commissionPercent: percent }
}

export function readCurtainAdvertiseFromProduct(
  product: Record<string, unknown> | null | undefined,
): CurtainAdvertiseConfig {
  const nested =
    product?.data && typeof product.data === 'object' && !Array.isArray(product.data)
      ? (product.data as Record<string, unknown>)
      : {}
  return (
    parseCurtainAdvertise(product?.curtainAdvertise) ||
    parseCurtainAdvertise(nested.curtainAdvertise) || {
      enabled: false,
      commissionPercent: CURTAIN_COMMISSION_DEFAULT,
    }
  )
}
