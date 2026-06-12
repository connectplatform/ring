'use client'
import React, { createContext } from 'react'
import type { PublicInstanceConfig } from '@/lib/ring-config-core'

export type { PublicInstanceConfig }

export const InstanceConfigContext = createContext<PublicInstanceConfig | null>(null)

export function InstanceConfigClientProvider({
  value,
  children,
}: {
  value: PublicInstanceConfig
  children: React.ReactNode
}) {
  return (
    <InstanceConfigContext.Provider value={value}>{children}</InstanceConfigContext.Provider>
  )
}
