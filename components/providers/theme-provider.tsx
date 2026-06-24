'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useInstanceConfig } from '@/hooks/use-instance-config'

type ThemeProviderProps = Parameters<typeof NextThemesProvider>[0]

function defaultThemeFromConfig(): 'light' | 'dark' | 'system' {
  try {
    const cfg = useInstanceConfig() as { theme?: { default?: string } }
    const value = cfg?.theme?.default ?? 'system'
    if (value === 'light' || value === 'dark' || value === 'system') return value
    if (value === 'auto') return 'system'
    return 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const defaultTheme = defaultThemeFromConfig()

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      enableColorScheme
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
