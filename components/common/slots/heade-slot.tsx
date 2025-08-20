'use client'
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInstanceConfig } from '@/hooks/use-instance-config'

export default function HeaderSlot() {
  const cfg = useInstanceConfig()
  const links = cfg.navigation?.links || []
  const logo = cfg.brand.logoUrl || '/images/logo.svg'
  return (
    <header className="w-full border-b border-border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <Link href="/">
          <Image src={logo} alt={cfg.name} width={96} height={32} className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
