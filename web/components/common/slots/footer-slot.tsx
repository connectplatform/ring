'use client'
import React from 'react'
import { useInstanceConfig } from '@/hooks/use-instance-config'

export default function FooterSlot() {
  const cfg = useInstanceConfig()
  const year = new Date().getFullYear()
  return (
    <footer className="w-full border-t border-border bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground flex items-center justify-between">
        <span>© {year} {cfg.name}</span>
        <span>Powered by Ring</span>
      </div>
    </footer>
  )
}
