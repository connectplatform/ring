'use client'
import React, { createContext } from 'react'

export type PublicInstanceConfig = {
  name: string
  brand: {
    colors: { primary: string; background: string; foreground: string; accent: string }
    logoUrl?: string
    faviconUrl?: string
    ogImageUrl?: string
  }
  seo?: { titleSuffix?: string; defaultDescription?: string }
  navigation?: { links?: Array<{ label: string; href: string }> }
  hero?: { title?: string; subtitle?: string; ctaText?: string; ctaHref?: string; showOnHome?: boolean }
  features: Record<string, boolean>
}

export const InstanceConfigContext = createContext<PublicInstanceConfig | null>(null)

export function InstanceConfigClientProvider({ value, children }: { value: PublicInstanceConfig; children: React.ReactNode }) {
  return (
    <InstanceConfigContext.Provider value={value}>{children}</InstanceConfigContext.Provider>
  )
}
