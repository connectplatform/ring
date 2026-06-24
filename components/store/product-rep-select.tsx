'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { BadgeCheck, Check, ChevronsUpDown, Loader2, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    <div className="flex items-center gap-3 min-w-0">
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
          {user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
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
  placeholder = 'Select representative',
  disabled = false,
  className,
}: ProductRepSelectProps) {
  const [open, setOpen] = useState(false)
  const { results, loading, error, search, clear, term } = useUserSearch()

  const handleSelect = (user: UserSearchResult) => {
    if (!user.username) return
    onChange?.(user.username)
    setOpen(false)
    clear()
  }

  const handleClear = () => {
    onChange?.('')
    clear()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) clear()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-11 w-full justify-between', !value && 'text-muted-foreground', className)}
          disabled={disabled}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">@{value}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search by username or name..."
            value={term}
            onChange={(e) => search(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-[280px]">
          {error && (
            <div className="px-3 py-4 text-center text-sm text-destructive">{error}</div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}
          {!loading && term.trim().length >= 2 && results.length === 0 && !error && (
            <div className="py-8 text-center text-sm text-muted-foreground">No users found.</div>
          )}
          {!loading && term.trim().length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          )}
          <div className="p-1">
            {results.map((user) => {
              if (!user.username) return null
              const selected = value === user.username
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    selected && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                  <UserBrief user={user} />
                </button>
              )
            })}
          </div>
        </ScrollArea>
        {value && (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={handleClear}>
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
