"use client"

import React, { use } from "react"
import type { Entity, Opportunity } from "@/types"

// React 19 Resource Preloading APIs
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

/**
 * Defines the shape of our application context
 */
interface AppContextType {
  entities: Entity[]
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>
  opportunities: Opportunity[]
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

// Create the context with a default value
const AppContext = React.createContext<AppContextType>({
  entities: [],
  setEntities: () => {},
  opportunities: [],
  setOpportunities: () => {},
  error: null,
  setError: () => {},
})

/**
 * AppProvider component with React 19 Resource Preloading
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = React.useState<Entity[]>([])
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([])
  const [error, setError] = React.useState<string | null>(null)

  // React 19 Resource Preloading - App-level Performance Optimization
  React.useEffect(() => {
    // DNS prefetching for app-specific domains
    prefetchDNS('https://firestore.googleapis.com')
    prefetchDNS('https://storage.googleapis.com')
    prefetchDNS('https://identitytoolkit.googleapis.com')
    prefetchDNS('https://securetoken.googleapis.com')
    
    // Preconnect to Firebase services
    preconnect('https://firestore.googleapis.com')
    preconnect('https://storage.googleapis.com')
    
    // Preload common entity and opportunity assets
    // preload('/images/entity-placeholder.svg', { as: 'image' })
    // preload('/images/opportunity-placeholder.svg', { as: 'image' })
    // preload('/images/user-avatar-placeholder.svg', { as: 'image' })
    
    // Preload common icons and UI assets
    // preload('/icons/building.svg', { as: 'image' })
    // preload('/icons/briefcase.svg', { as: 'image' })
    // preload('/icons/map-pin.svg', { as: 'image' })
    // preload('/icons/calendar.svg', { as: 'image' })
    
    // Preinit app-level scripts
    preinit('/scripts/app-analytics.js', { as: 'script' })
    preinit('/scripts/error-tracking.js', { as: 'script' })
    
    // Preload API endpoints for faster data fetching
    // preload('/api/entities', { as: 'fetch' })
    // preload('/api/opportunities', { as: 'fetch' })
  }, [])

  const value = {
    entities,
    setEntities,
    opportunities,
    setOpportunities,
    error,
    setError,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/**
 * Custom hook to use the app context
 * Uses React 19's use() hook for better performance and error handling
 */
export function useAppContext() {
  const context = use(AppContext)
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}