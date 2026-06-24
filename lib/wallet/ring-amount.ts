import 'server-only'

import { getRingTokenDecimals } from '@/lib/ring-config-chain'

/** 8-decimal RING SPL amount helpers — never use float for on-chain raw values. */
export function ringUiToRaw(uiAmount: string, decimals?: number): bigint {
  const dec = decimals ?? getRingTokenDecimals('solana')
  const [whole, frac = ''] = uiAmount.trim().split('.')
  const padded = (frac + '0'.repeat(dec)).slice(0, dec)
  const sign = whole.startsWith('-') ? -1n : 1n
  const absWhole = whole.replace(/^-/, '') || '0'
  return sign * (BigInt(absWhole) * 10n ** BigInt(dec) + BigInt(padded || '0'))
}

export function ringRawToUi(raw: bigint, decimals?: number): string {
  const dec = decimals ?? getRingTokenDecimals('solana')
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const divisor = 10n ** BigInt(dec)
  const whole = abs / divisor
  const frac = abs % divisor
  const fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '')
  const ui = fracStr ? `${whole}.${fracStr}` : whole.toString()
  return negative ? `-${ui}` : ui
}

export function applyBps(amountRaw: bigint, bps: number): bigint {
  return (amountRaw * BigInt(bps)) / 10_000n
}
