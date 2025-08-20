import type { Listing } from '../types'

export async function fetchUserActiveListingsByUsernameClient(username: string, limit = 12): Promise<Listing[]> {
  const res = await fetch(`/api/nft-market/listings?username=${encodeURIComponent(username)}&status=active&limit=${limit}`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json()
  return (json?.data || []) as Listing[]
}


