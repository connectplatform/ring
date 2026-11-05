"use client"

import React, { use } from "react"
import type { Entity, Opportunity } from "@/types"

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
 * App-wide entity and opportunity lists.
 * Page views are RingAnalyticsBeacon only. Do not preinit app-analytics.js here.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = React.useState<Entity[]>([])
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([])
  const [error, setError] = React.useState<string | null>(null)

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