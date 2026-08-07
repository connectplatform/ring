'use client'
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useInstanceConfig } from '@/hooks/use-instance-config'
import { Leaf } from 'lucide-react'

export default function HeaderSlot() {
  const cfg = useInstanceConfig()
  const links = cfg.navigation?.links || []
  const logo = cfg.brand.logoUrl || '/images/logo.svg'
  return (
    <header className="w-full border-b border-emerald-200 dark:border-emerald-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/95">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
              GreenFood.live
            </span>
            <span className="text-[10px] text-gray-600 dark:text-gray-400 -mt-1">
              Farm to Table, Trust to Token
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {links.map((l) => (
            <Link 
              key={l.href} 
              href={l.href} 
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
