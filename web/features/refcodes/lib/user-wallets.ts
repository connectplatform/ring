import { db } from '@/lib/database'

/** Wallet addresses linked to a user (primary + additional). */
export async function getWalletAddressesForUser(userId: string): Promise<string[]> {
  const result = await db().readDoc<Record<string, unknown>>('users', userId)
  if (!result.success || !result.data) return []

  const userData = result.data
  const addresses: string[] = []
  if (userData.walletAddress) addresses.push(userData.walletAddress as string)
  for (const w of (userData.additionalWallets as { address?: string }[]) || []) {
    if (w?.address) addresses.push(w.address)
  }
  return addresses
}
