/** Address helpers */
export function shortenAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address) return ''
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

export function formatAddress(address?: string | null): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/** Amount formatting/parsing using BigInt */
export function formatTokenAmount(
  amount: string | number | bigint,
  tokenDecimals: number = 18,
  displayDecimals: number = 4
): string {
  try {
    const raw = typeof amount === 'bigint' ? amount : BigInt(parseTokenAmount(String(amount), tokenDecimals))
    const base = BigInt(10) ** BigInt(tokenDecimals)
    const integerPart = raw / base
    const fractionalPart = raw % base
    if (displayDecimals <= 0) return integerPart.toString()
    const scale = BigInt(10) ** BigInt(tokenDecimals - Math.min(tokenDecimals, displayDecimals))
    const trimmedFraction = Number((fractionalPart / scale).toString())
    const padded = trimmedFraction.toString().padStart(Math.min(tokenDecimals, displayDecimals), '0')
    const shown = padded.slice(0, displayDecimals)
    const cleaned = shown.replace(/0+$/, '')
    return cleaned ? `${integerPart.toString()}.${cleaned}` : integerPart.toString()
  } catch {
    const n = Number(amount)
    if (Number.isFinite(n)) return n.toFixed(displayDecimals)
    return '0'
  }
}

export function parseTokenAmount(amount: string, tokenDecimals: number = 18): string {
  // Accepts a decimal string and returns the smallest-unit integer as string
  if (!amount || !isFinite(Number(amount))) return '0'
  const [intStr, fracStr = ''] = amount.trim().split('.')
  const normalizedFrac = (fracStr + '0'.repeat(tokenDecimals)).slice(0, tokenDecimals)
  const full = `${intStr}${normalizedFrac}`.replace(/^0+(?=\d)/, '')
  return full === '' ? '0' : full
}

/** APR formatting */
export function formatAPR(aprPercent: number): string {
  return `${aprPercent.toFixed(2)}%`
}

/** Epoch time helper */
export function calculateTimeUntilNextEpoch(epochEndTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const timeLeft = Math.max(0, epochEndTimestamp - now)
  if (timeLeft <= 0) return '0m'
  const days = Math.floor(timeLeft / 86400)
  const hours = Math.floor((timeLeft % 86400) / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}


