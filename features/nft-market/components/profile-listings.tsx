"use client"

import React from 'react'
import { fetchUserActiveListingsByUsernameClient } from '@/features/nft-market/adapters/read.client'
import type { Listing } from '@/features/nft-market/types'

export default function ProfileListings({ username }: { username: string }) {
  const [listings, setListings] = React.useState<Listing[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    fetchUserActiveListingsByUsernameClient(username, 12)
      .then((items) => { if (isMounted) setListings(items) })
      .catch((e) => { if (isMounted) setError(e?.message || 'Failed to load listings') })
    return () => { isMounted = false }
  }, [username])

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  if (!listings) {
    return <div className="text-sm text-muted-foreground">Loading listings...</div>
  }

  if (listings.length === 0) {
    return <div className="text-sm text-muted-foreground">No active listings</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((l) => (
        <article key={l.id} className="rounded-lg border p-4 hover:shadow">
          <div className="text-xs text-muted-foreground mb-1">{l.item.slug || l.item.address}</div>
          <div className="font-medium">Token #{l.item.tokenId}</div>
          <div className="mt-2 text-sm">Price: {l.price.amount} {l.price.currency}</div>
          <div className="mt-2 text-xs text-muted-foreground">Status: {l.status}</div>
        </article>
      ))}
    </div>
  )
}


