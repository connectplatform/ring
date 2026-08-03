/**
 * Pure FX convert helpers — client-safe (no server-only).
 * Shared by currency-context (browser) and optionally ring-config-core.
 *
 * `rates` is units-per-1-base style (main usually = 1). Same math as
 * ring-config-core convertTo/FromMainCurrency.
 */

export function convertToMainWithRates(
  amount: number,
  currencyCode: string | undefined,
  rates: Record<string, number>,
  main: string,
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
  return (amount * mainRate) / fromRate
}

export function convertFromMainWithRates(
  amount: number,
  currencyCode: string | undefined,
  rates: Record<string, number>,
  main: string,
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
): number {
  const inMain = convertToMainWithRates(amount, from, rates, main)
  return convertFromMainWithRates(inMain, to, rates, main)
}
