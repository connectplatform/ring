/**
 * Isomorphic 8-decimal native token amount helpers — never use float for on-chain raw values.
 * Safe for Client Components and Server Components (no `server-only`, no ring-config imports).
 * Pass `decimals` explicitly when the active chain is not Solana (default 8).
 */

/** Default Solana native decimals when caller does not pass an explicit value. */
const DEFAULT_NATIVE_DECIMALS = 8

/**
 * Converts a human-readable token amount (uiAmount) to its on-chain raw bigint representation.
 *
 * @param uiAmount string The user interface amount as a string, e.g. "1.234"
 * @param decimals number (optional) Decimals to use, defaults to Solana native (8).
 * @returns bigint The raw amount as an integer (BigInt)
 */
export function nativeTokenUiToRaw(uiAmount: string, decimals: number = DEFAULT_NATIVE_DECIMALS): bigint {
  const dec = decimals
  const [whole, frac = ''] = uiAmount.trim().split('.')
  const padded = (frac + '0'.repeat(dec)).slice(0, dec)
  const sign = whole.startsWith('-') ? -1n : 1n
  const absWhole = whole.replace(/^-/, '') || '0'
  return sign * (BigInt(absWhole) * 10n ** BigInt(dec) + BigInt(padded || '0'))
}

/**
 * Converts a raw bigint token value back to a human-readable (UI) string representation.
 *
 * @param raw bigint The amount in raw token units (e.g. lamports)
 * @param decimals number (optional) Decimals to use, defaults to Solana native (8).
 * @returns string The formatted amount as a string
 */
export function nativeTokenRawToUi(raw: bigint, decimals: number = DEFAULT_NATIVE_DECIMALS): string {
  const dec = decimals
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const divisor = 10n ** BigInt(dec)
  const whole = abs / divisor
  const frac = abs % divisor
  const fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '')
  const ui = fracStr ? `${whole}.${fracStr}` : whole.toString()
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
  return (amountRaw * BigInt(bps)) / 10_000n
}
