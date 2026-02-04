'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useInstanceConfig } from '@/hooks/use-instance-config'

type ThemeProviderProps = Parameters<typeof NextThemesProvider>[0]

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Pull default theme from instance config if present ("light" | "dark" | "system" | "auto")
  let defaultTheme: 'light' | 'dark' | 'system' | 'auto' = 'auto'
  try {
    const cfg = useInstanceConfig() as any
    defaultTheme = cfg?.theme?.default ?? 'auto'
  } catch {
    // outside provider in SSR head path; fall back to auto
  }
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}