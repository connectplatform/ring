'use client'

import { useEffect, useState } from 'react'
import { Chrono, type TimelineItemModel } from 'react-chrono'

export interface TimelineProps {
  items: TimelineItemModel[]
  mode?: 'VERTICAL' | 'VERTICAL_ALTERNATING' | 'HORIZONTAL'
  className?: string
}

export function Timeline({ items, mode = 'VERTICAL_ALTERNATING', className }: TimelineProps) {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setMounted(true)
    const root = document.documentElement
    const read = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  if (!items.length) return null

  if (!mounted) {
    return (
      <div
        className={`${className ?? 'my-8 w-full'} h-64 animate-pulse rounded-lg bg-muted`}
        aria-hidden
      />
    )
  }

  return (
    <div className={className ?? 'my-8 w-full'}>
      <Chrono
        items={items}
        mode={mode}
        theme={{
          primary: 'hsl(var(--primary))',
          secondary: 'hsl(var(--muted))',
          cardBgColor: theme === 'dark' ? 'hsl(var(--card))' : 'hsl(var(--card))',
          titleColor: 'hsl(var(--foreground))',
          titleColorActive: 'hsl(var(--primary))',
        }}
        fontSizes={{
          cardSubtitle: '0.85rem',
          cardText: '0.9rem',
          cardTitle: '1rem',
          title: '0.95rem',
        }}
        disableToolbar
        cardHeight={120}
        scrollable={{ scrollbar: false }}
      />
    </div>
  )
}
