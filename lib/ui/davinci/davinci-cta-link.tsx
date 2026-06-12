'use client'

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { davinciCtaPrimary } from './glass-surface'

export interface DavinciCtaLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  external?: boolean
}

export function DavinciCtaLink({
  href,
  children,
  className,
  external = true,
}: DavinciCtaLinkProps) {
  return (
    <a
      href={href}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      className={cn(
        davinciCtaPrimary,
        'flex items-center justify-center gap-2 rounded-[inherit] px-6 py-4 text-center text-sm sm:text-base',
        className
      )}
    >
      {children}
      <ArrowRight className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
    </a>
  )
}
