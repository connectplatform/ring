import { getAdminDb } from '@/lib/firebase-admin.server'
import type { Listing } from '../types'

export async function fetchUserActiveListingsByUsername(username: string, limit = 12): Promise<Listing[]> {
  const db = await getAdminDb()
  const col = db.collection('nft_listings')
  const snap = await col.where('sellerUsername', '==', username).where('status', '==', 'active').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]
}

export async function fetchCollectionListings(slugOrAddress: string, limit = 24): Promise<Listing[]> {
  const db = await getAdminDb()
  const col = db.collection('nft_listings')
  const snap = await col.where('item.slug', '==', slugOrAddress).where('status', '==', 'active').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]
}


