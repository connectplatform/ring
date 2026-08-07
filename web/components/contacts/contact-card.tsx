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
  /**
   * `stacked` (default): name + secondary lines.
   * `inline`: one-line [avatar] Full name … @username — no wallet snippet.
   */
  layout?: 'stacked' | 'inline'
  /** Force-hide wallet address (inline always hides). */
  hideAddress?: boolean
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
  layout = 'stacked',
  hideAddress = false,
  className,
}: ContactCardProps) {
  const displayName = name || username || (address ? formatAddress(address) : 'Unknown')
  const initials = displayName.slice(0, 2).toUpperCase()
  const shouldLink = linkToProfile ?? (Boolean(username) && !onClick)
  const showAddress = !hideAddress && layout !== 'inline' && Boolean(address)

  const inner =
    layout === 'inline' ? (
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2',
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
          {isOnline ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="min-w-0 truncate text-sm font-medium">{displayName}</p>
        {isVerified ? (
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified" />
        ) : null}
        {isFavorite ? (
          <span className="shrink-0 text-xs text-amber-500" aria-hidden>
            ★
          </span>
        ) : null}
        <span className="min-w-2 flex-1" aria-hidden />
        {username ? (
          <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
            @{username}
          </span>
        ) : null}
        {actions ? <div className="ml-1 flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    ) : (
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
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
          {isOnline ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {isVerified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified" />
            ) : null}
            {isFavorite ? (
              <span className="shrink-0 text-xs text-amber-500" aria-hidden>
                ★
              </span>
            ) : null}
          </div>
          {username && name && username !== name ? (
            <p className="truncate text-xs text-muted-foreground">@{username}</p>
          ) : null}
          {!username && showAddress ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {formatAddress(address!)}
            </p>
          ) : null}
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          {showAddress && username ? (
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {formatAddress(address!)}
            </p>
          ) : null}
        </div>
        {actions ? <div className="ml-2 flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    )

  if (shouldLink && username) {
    return (
      <Link
        href={ROUTES.PUBLIC_PROFILE(username, locale)}
        className="flex min-w-0 items-center transition-opacity hover:opacity-80"
      >
        {inner}
      </Link>
    )
  }

  return <div className="flex w-full min-w-0 items-center">{inner}</div>
}
