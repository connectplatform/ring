'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { LocaleCodeMenu } from '@/components/common/locale-code-menu'
import { Button } from '@/components/ui/button'

/** Docs right-sidebar header: Globe locale menu (native names) + icon theme toggle. */
export default function DocsSidebarControls() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex items-center gap-1 shrink-0">
      <LocaleCodeMenu variant="docs" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
        aria-label="Toggle theme"
        suppressHydrationWarning
      >
        {!mounted ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4" aria-hidden />
        ) : (
          <Sun className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </div>
  )
}
