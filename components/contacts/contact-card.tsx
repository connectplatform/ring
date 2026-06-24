'use client'

import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

export interface ContactCardProps {
  locale: Locale
  id?: string
  name?: string | null
  username?: string | null
  photoURL?: string | null
  address?: string | null
  isVerified?: boolean
  isFavorite?: boolean
  isOnline?: boolean
  subtitle?: string | null
  actions?: React.ReactNode
  onClick?: () => void
  compact?: boolean
  /** When false, username does not link to public profile (picker rows). Default: true if username and no onClick */
  linkToProfile?: boolean
  className?: string
}

function formatAddress(address: string) {
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function ContactCard({
  locale,
  name,
  username,
  photoURL,
  address,
  isVerified = false,
  isFavorite = false,
  isOnline,
  subtitle,
  actions,
  onClick,
  compact = true,
  linkToProfile,
  className,
}: ContactCardProps) {
  const displayName = name || username || (address ? formatAddress(address) : 'Unknown')
  const initials = displayName.slice(0, 2).toUpperCase()
  const shouldLink = linkToProfile ?? (Boolean(username) && !onClick)

  const inner = (
    <div
      className={cn(
        'flex items-center gap-3 min-w-0 flex-1',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="relative shrink-0">
        <Avatar
          src={photoURL}
          alt={displayName}
          size={compact ? 'sm' : 'md'}
          fallback={initials}
        />
        {isOnline && (
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Verified" />
          )}
          {isFavorite && (
            <span className="text-xs text-amber-500 shrink-0" aria-hidden>
              ★
            </span>
          )}
        </div>
        {username && name && username !== name && (
          <p className="text-xs text-muted-foreground truncate">@{username}</p>
        )}
        {!username && address && (
          <p className="text-xs text-muted-foreground font-mono truncate">{formatAddress(address)}</p>
        )}
        {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
        {address && username && (
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {formatAddress(address)}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0 ml-2">{actions}</div>}
    </div>
  )

  if (shouldLink && username) {
    return (
      <Link
        href={ROUTES.PUBLIC_PROFILE(username, locale)}
        className="flex items-center hover:opacity-80 transition-opacity min-w-0"
      >
        {inner}
      </Link>
    )
  }

  return <div className="flex items-center min-w-0 w-full">{inner}</div>
}
