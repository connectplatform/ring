/**
 * Pure FX convert helpers — client-safe (no server-only).
 * Shared by currency-context (browser) and ring-config-core.
 *
 * Two rate conventions live in the same `exchangeRates` table:
 * - Fiat (when `rates[main] === 1`): `rates[code]` is *code units per 1 main*
 *   (e.g. main=UAH, USD=0.02222 → 1 UAH = 0.02222 USD).
 * - Native token: `rates[native]` is *main units per 1 native* (membership / oracle
 *   SSOT, e.g. DAARION=45000 → 1 DAARION = 45000 UAH). Invert vs fiat math.
 */

export function convertToMainWithRates(
  amount: number,
  currencyCode: string | undefined,
  rates: Record<string, number>,
  main: string,
  nativeTokenSymbol?: string,
): number {
  if (!Number.isFinite(amount)) return 0
  const code = (currencyCode || main).trim().toUpperCase()
  if (!code || code === main) return amount

  const fromRate = rates[code]
  const mainRate = rates[main]
  if (
    typeof fromRate !== 'number' ||
    !Number.isFinite(fromRate) ||
    fromRate <= 0 ||
    typeof mainRate !== 'number' ||
    !Number.isFinite(mainRate) ||
    mainRate <= 0
  ) {
    return amount
  }

  const native = nativeTokenSymbol?.trim().toUpperCase()
  if (native && code === native) {
    // amount_native × (main per native) / (main per main-unit)
    return (amount * fromRate) / mainRate
  }
  // Fiat: amount_code × mainRate / (code per 1 main)
  return (amount * mainRate) / fromRate
}

export function convertFromMainWithRates(
  amount: number,
  currencyCode: string | undefined,
  rates: Record<string, number>,
  main: string,
  nativeTokenSymbol?: string,
): number {
  if (!Number.isFinite(amount)) return 0
  const code = (currencyCode || main).trim().toUpperCase()
  if (!code || code === main) return amount

  const toRate = rates[code]
  const mainRate = rates[main]
  if (
    typeof toRate === 'number' &&
    Number.isFinite(toRate) &&
    toRate > 0 &&
    typeof mainRate === 'number' &&
    Number.isFinite(mainRate) &&
    mainRate > 0
  ) {
    const native = nativeTokenSymbol?.trim().toUpperCase()
    if (native && code === native) {
      // amount_main / (main per native)
      return (amount * mainRate) / toRate
    }
    return (amount * toRate) / mainRate
  }
  return amount
}

/** amount_in_from → main → amount_in_to */
export function convertViaRates(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
  main: string,
  nativeTokenSymbol?: string,
): number {
  const inMain = convertToMainWithRates(amount, from, rates, main, nativeTokenSymbol)
  return convertFromMainWithRates(inMain, to, rates, main, nativeTokenSymbol)
}
