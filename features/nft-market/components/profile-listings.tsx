"use client"

import React from 'react'
import { fetchUserActiveListingsByUsernameClient } from '@/features/nft-market/adapters/read.client'
import type { Listing } from '@/features/nft-market/types'

// TODO: Upgrade data fetching to use React 19's useOptimistic or use hook when available in Next.js 16.
// TODO: Replace manual loading/error management with new native loading/error handling patterns if supported in the app target.

export default function ProfileListings({ username }: { username: string }) {
  // State for fetched listings; null while loading, array when loaded
  const [listings, setListings] = React.useState<Listing[] | null>(null)
  // State for possible error message; null when no error
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Track component mounted status to avoid state updates after unmount
    let isMounted = true
    // Fetch user's active listings, limit to 12
    fetchUserActiveListingsByUsernameClient(username, 12)
      .then((items) => { if (isMounted) setListings(items) }) // Set listings if component is still mounted
      .catch((e) => { if (isMounted) setError(e?.message || 'Failed to load listings') }) // Set error state safely
    // Cleanup: set isMounted to false on component unmount
    return () => { isMounted = false }
  }, [username]) // Refetch listings whenever the username changes

  // Show error state if fetching listings failed
  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  // Show loading message until listings data is loaded
  if (!listings) {
    return <div className="text-sm text-muted-foreground">Loading listings...</div>
  }

  // Show a message if the user has no active listings
  if (listings.length === 0) {
    return <div className="text-sm text-muted-foreground">No active listings</div>
  }

  // Listings exist: render as grid of cards
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((l) => (
        <article key={l.id} className="rounded-lg border p-4 hover:shadow">
          {/* Display slug if available, otherwise fallback to address */}
          <div className="text-xs text-muted-foreground mb-1">{l.item.slug || l.item.address}</div>
          {/* Show the tokenId for the NFT */}
          <div className="font-medium">Token #{l.item.tokenId}</div>
          {/* Display price and currency */}
          <div className="mt-2 text-sm">
            Price: {l.price.amount}{' '}
            {l.price.currency.symbol || l.price.currency.name}
          </div>
          {/* Show listing status */}
          <div className="mt-2 text-xs text-muted-foreground">Status: {l.status}</div>
        </article>
      ))}
    </div>
  )
}
