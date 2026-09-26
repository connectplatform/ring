'use client'

import React, { createContext, useContext } from 'react'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'

export type EnabledLocalesValue = readonly Locale[]

const EnabledLocalesContext = createContext<EnabledLocalesValue | null>(null)

/**
 * Locale list SSOT for language selector widgets (left rail, mobile ring-menu,
 * docs controls, floating panel). The server chrome resolves the list from
 * ring-config `localization.supportedLocales` (getEnabledLocales) and mounts
 * this provider; widgets render exactly the enabled clone languages.
 *
 * Without a provider (bare L1 layouts without the chrome), consumers fall back
 * to the env-driven SUPPORTED_LOCALES list.
 */
export function EnabledLocalesProvider({
  locales,
  children,
}: {
  locales: readonly string[]
  children: React.ReactNode
}) {
  const valid = (locales || []).filter((l): l is Locale =>
    (SUPPORTED_LOCALES as readonly string[]).includes(l),
  )
  return (
    <EnabledLocalesContext.Provider value={valid.length ? valid : SUPPORTED_LOCALES}>
      {children}
    </EnabledLocalesContext.Provider>
  )
}

export function useEnabledLocales(): readonly Locale[] {
  const ctx = useContext(EnabledLocalesContext)
  return ctx ?? SUPPORTED_LOCALES
}
