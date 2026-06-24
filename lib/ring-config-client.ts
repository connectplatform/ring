/**
 * Client-safe ring-config accessors (reads ring-config.json via ring-config-core).
 * Use instead of hardcoding USD / RING in wallet UI components.
 */
import { getRingConfigSnapshot } from '@/lib/ring-config-core'

export function getClientRingTokenSymbol(): string {
  return getRingConfigSnapshot().tokens?.ring?.symbol ?? 'RING'
}

export function getClientCreditFiatCurrency(): string {
  const tokens = getRingConfigSnapshot().tokens
  return tokens?.creditFiatCurrency ?? tokens?.creditUnit ?? 'USD'
}

export function getClientRingTokenName(): string {
  return getRingConfigSnapshot().tokens?.ring?.name ?? 'RING Governance Token'
}

export function getClientRingTokenDecimals(chain?: 'solana' | 'evm'): number {
  const config = getRingConfigSnapshot()
  if (chain === 'solana') {
    return config.chains?.solana?.decimals ?? config.tokens?.ring?.decimals ?? 8
  }
  if (chain === 'evm') {
    return config.chains?.evm?.decimals ?? 18
  }
  return config.tokens?.ring?.decimals ?? 8
}

/** Native fiat + native token symbols for opportunity budget currency select (ring-config SSOT). */
export function getClientOpportunityBudgetCurrencies(): Array<{ value: string; label: string }> {
  const fiat = getClientCreditFiatCurrency()
  const token = getClientRingTokenSymbol()
  return [
    { value: fiat, label: fiat },
    { value: token, label: token },
  ]
}
