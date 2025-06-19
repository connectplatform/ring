'use client'

import React from 'react'
import type { Entity } from '@/types'

// Define the context type
interface ConfidentialEntitiesContextType {
  entities: Entity[]
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

// Create the context with a default value
const ConfidentialEntitiesContext = React.createContext<ConfidentialEntitiesContextType>({
  entities: [],
  setEntities: () => {},
  error: null,
  setError: () => {},
})

// Provider props interface
interface ConfidentialEntitiesProviderProps {
  children: React.ReactNode
  initialEntities: Entity[]
  initialError: string | null
}

// Provider component
export function ConfidentialEntitiesProvider({
  children,
  initialEntities,
  initialError
}: ConfidentialEntitiesProviderProps) {
  const [entities, setEntities] = React.useState<Entity[]>(initialEntities)
  const [error, setError] = React.useState<string | null>(initialError)

  const value = {
    entities,
    setEntities,
    error,
    setError
  }

  return (
    <ConfidentialEntitiesContext.Provider value={value}>
      {children}
    </ConfidentialEntitiesContext.Provider>
  )
}

// Custom hook to use the context
export function useConfidentialEntities() {
  const context = React.useContext(ConfidentialEntitiesContext)
  if (!context) {
    throw new Error('useConfidentialEntities must be used within a ConfidentialEntitiesProvider')
  }
  return context
}