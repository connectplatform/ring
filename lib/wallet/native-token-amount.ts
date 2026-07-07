import 'server-only' // Enforces code runs server-side only (Next.js feature)

import { getNativeTokenDecimals } from '@/lib/ring-config-chain'

/**
 * 8-decimal native token amount helpers — never use float for on-chain raw values.
 * Converts a human-readable token amount (uiAmount) to its on-chain raw bigint representation.
 * 
 * @param uiAmount string The user interface amount as a string, e.g. "1.234"
 * @param decimals number (optional) Decimals to use, defaults to Solana's native token decimals.
 * @returns bigint The raw amount as an integer (BigInt)
 */
export function nativeTokenUiToRaw(uiAmount: string, decimals?: number): bigint {
  // Determine decimals: either explicitly provided or get from chain config
  const dec = decimals ?? getNativeTokenDecimals('solana')
  // Split into whole and fractional part; handles numbers like "1.23" => ["1", "23"]
  const [whole, frac = ''] = uiAmount.trim().split('.')
  // Pad the fraction to the correct number of decimals, slice in case user entered too many decimals
  const padded = (frac + '0'.repeat(dec)).slice(0, dec)
  // Determine the sign: -1n for negative numbers, otherwise 1n
  const sign = whole.startsWith('-') ? -1n : 1n
  // Remove possible negative sign from the whole part for computation; fallback to '0' if whole is empty
  const absWhole = whole.replace(/^-/, '') || '0'
  // Calculate the raw on-chain value: (whole * 10^dec) + padded fraction, adapt sign
  return sign * (BigInt(absWhole) * 10n ** BigInt(dec) + BigInt(padded || '0'))
}

/**
 * Converts a raw bigint token value back to a human-readable (UI) string representation.
 * Handles sign, decimal placement, and trims trailing zeros from the fractional part.
 * 
 * @param raw bigint The amount in raw token units (e.g. lamports)
 * @param decimals number (optional) Decimals to use, defaults to Solana's native token decimals.
 * @returns string The formatted amount as a string
 */
export function nativeTokenRawToUi(raw: bigint, decimals?: number): string {
  // Determine decimals: either explicitly provided or get from chain config
  const dec = decimals ?? getNativeTokenDecimals('solana')
  // Track negativeness; work only with absolute values for string manipulation
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  // divisor is the factor to shift decimal point (10^decimals)
  const divisor = 10n ** BigInt(dec)
  // Compute the whole (integer) part, and the raw fractional remainder
  const whole = abs / divisor
  const frac = abs % divisor
  // Convert fraction to string, pad leading 0's, then trim trailing 0's for aesthetics
  const fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '')
  // If there's a fractional part left, compose as whole + "." + fraction; otherwise just whole part
  const ui = fracStr ? `${whole}.${fracStr}` : whole.toString()
  // If negative, prepend "-"
  return negative ? `-${ui}` : ui
}

/**
 * Applies basis points (bps) adjustment to a raw bigint amount.
 * 1 basis point = 0.01% (so divide by 10,000).
 * 
 * @param amountRaw bigint The original raw value
 * @param bps number The basis points (e.g. 100 = 1%, 35 = 0.35%)
 * @returns bigint The adjusted value after applying bps
 */
export function applyBps(amountRaw: bigint, bps: number): bigint {
  // Multiply by bps, then divide by 10,000 for basis point calculation
  return (amountRaw * BigInt(bps)) / 10_000n
}
