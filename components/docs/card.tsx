import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface CardsProps {
  children: ReactNode
  className?: string
}

export interface CardProps {
  title: string
  href: string
  children?: ReactNode
}

/** Grid container for doc link cards (examples hub, feature index pages). */
export function Cards({ children, className }: CardsProps) {
  return (
    <div className={`my-8 grid gap-4 sm:grid-cols-2 ${className ?? ''}`.trim()}>
      {children}
    </div>
  )
}

/** Linked doc card — distinct from shadcn `UiCard` in the MDX component map. */
export function Card({ title, href, children }: CardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground group-hover:text-primary">{title}</h3>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      {children ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </Link>
  )
}
