'use client'

import React, { use } from 'react'
import type { Opportunity } from '@/types'

// Define the context type
interface ConfidentialOpportunitiesContextType {
  opportunities: Opportunity[]
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

// Create the context with a default value
const ConfidentialOpportunitiesContext = React.createContext<ConfidentialOpportunitiesContextType>({
  opportunities: [],
  setOpportunities: () => {},
  error: null,
  setError: () => {},
})

// Provider props interface
interface ConfidentialOpportunitiesProviderProps {
  children: React.ReactNode
  initialOpportunities: Opportunity[]
  initialError: string | null
}

// Provider component
export function ConfidentialOpportunitiesProvider({
  children,
  initialOpportunities,
  initialError
}: ConfidentialOpportunitiesProviderProps) {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(initialOpportunities)
  const [error, setError] = React.useState<string | null>(initialError)

  const value = {
    opportunities,
    setOpportunities,
    error,
    setError
  }

  return (
    <ConfidentialOpportunitiesContext.Provider value={value}>
      {children}
    </ConfidentialOpportunitiesContext.Provider>
  )
}

// Custom hook to use the context with React 19's use() hook
export function useConfidentialOpportunities() {
  const context = use(ConfidentialOpportunitiesContext)
  if (!context) {
    throw new Error('useConfidentialOpportunities must be used within a ConfidentialOpportunitiesProvider')
  }
  return context
}