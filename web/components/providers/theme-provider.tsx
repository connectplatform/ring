'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

type ThemeName = 'light' | 'dark' | 'system'

/**
 * ring-config `theme.default` → next-themes.
 * `auto` means follow the OS. Anything else is `system`.
 * Pure function: do not call `use()` here. The shell already holds the config object.
 */
export function themeDefaultFromInstance(value: string | undefined): ThemeName {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  if (value === 'auto') return 'system'
  return 'system'
}

type ThemeProviderProps = Parameters<typeof NextThemesProvider>[0]

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  ...props
}: ThemeProviderProps) {
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
