'use client'
import React from 'react'
import { NovaPostSelector, NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'

export function ShippingStep({ location, setLocation }: { location: NovaPostLocation | null, setLocation: (l: NovaPostLocation | null) => void }) {
  return (
    <div className="space-y-3">
      <NovaPostSelector selected={location} onSelect={setLocation} />
      {location && (
        <div className="text-sm text-muted-foreground">Selected: {location.settlement?.name} - {location.name}</div>
      )}
    </div>
  )
}


