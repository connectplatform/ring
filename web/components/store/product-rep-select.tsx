'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { BadgeCheck, ChevronsUpDown, Loader2, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'
import { useUserSearch } from '@/hooks/use-user-search'
import type { UserSearchResult } from '@/features/auth/services/search-users'

interface ProductRepSelectProps {
  value?: string
  onChange?: (username: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function UserBrief({ user }: { user: UserSearchResult }) {
  const label = user.name || user.username || user.id
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
        {user.photoURL ? (
          <Image src={user.photoURL} alt="" fill className="object-cover" sizes="36px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium">{label}</span>
          {user.isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          )}
        </div>
        {user.username && (
          <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
        )}
      </div>
    </div>
  )
}

export default function ProductRepSelect({
  value = '',
  onChange,
  placeholder,
  disabled = false,
  className,
}: ProductRepSelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const [open, setOpen] = useState(false)
  const { results, loading, error, search, clear, term } = useUserSearch()

  const scopeLabel = t('scopes.representative')
  const triggerPlaceholder = placeholder ?? t('selectTitle', { scope: scopeLabel })

  const handleSelect = (user: UserSearchResult) => {
    if (!user.username) return
    onChange?.(user.username)
    clear()
    setOpen(false)
  }

  const handleClear = () => {
    onChange?.('')
    clear()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) clear()
  }

  const showHint = !loading && term.trim().length < 2
  const showEmpty =
    !loading && term.trim().length >= 2 && results.length === 0 && !error
  const empty = showHint || showEmpty

  const emptyMessage = showHint
    ? t('searchHintMinChars', { count: 2 })
    : t('noResults')

  return (
    <DavinciDroplist
      open={open}
      onOpenChange={handleOpenChange}
      scopeLabel={scopeLabel}
      search={term}
      onSearchChange={search}
      empty={empty && !error && !loading}
      emptyMessage={emptyMessage}
      footer={
        value ? (
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={handleClear}>
            {t('clearSelection')}
          </Button>
        ) : undefined
      }
      trigger={
        <DavinciDroplistTrigger
          open={open}
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn('md:h-11', !value && 'text-muted-foreground', className)}
        >
          {value ? (
            <>
              <span className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">@{value}</span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {triggerPlaceholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </DavinciDroplistTrigger>
      }
    >
      {error && (
        <div className="px-3 py-4 text-center text-sm text-destructive">{error}</div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('searching')}
        </div>
      )}
      {!loading &&
        results.map((user) => {
          if (!user.username) return null
          const selected = value === user.username
          return (
            <DavinciDroplistItem
              key={user.id}
              selected={selected}
              onSelect={() => handleSelect(user)}
            >
              <UserBrief user={user} />
            </DavinciDroplistItem>
          )
        })}
    </DavinciDroplist>
  )
}
