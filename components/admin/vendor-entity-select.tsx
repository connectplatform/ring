'use client'

import React, { useMemo, useState } from 'react'
import { ChevronsUpDown, Store } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'

export interface VendorEntityOption {
  id: string
  name: string
  storeSlug?: string
}

interface VendorEntitySelectProps {
  vendors: VendorEntityOption[]
  value?: string
  onChange?: (entityId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function VendorEntitySelect({
  vendors,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: VendorEntitySelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const scopeLabel = t('scopes.vendor')
  const triggerPlaceholder =
    placeholder ?? t('selectTitle', { scope: scopeLabel })

  const selected = vendors.find((v) => v.id === value)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return vendors
    const q = searchQuery.toLowerCase()
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.storeSlug?.toLowerCase().includes(q) ?? false),
    )
  }, [vendors, searchQuery])

  const handleSelect = (entityId: string) => {
    onChange?.(entityId)
    setSearchQuery('')
    setOpen(false)
  }

  return (
    <DavinciDroplist
      open={open}
      onOpenChange={setOpen}
      scopeLabel={scopeLabel}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      empty={filtered.length === 0}
      trigger={
        <DavinciDroplistTrigger
          open={open}
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn('md:h-11', !value && 'text-muted-foreground', className)}
        >
          {selected ? (
            <>
              <span className="flex items-center gap-2 truncate">
                <Store className="h-4 w-4 shrink-0" />
                <span className="truncate">{selected.name}</span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                {triggerPlaceholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </DavinciDroplistTrigger>
      }
    >
      {filtered.map((vendor) => (
        <DavinciDroplistItem
          key={vendor.id}
          selected={value === vendor.id}
          onSelect={() => handleSelect(vendor.id)}
        >
          <span className="flex-1 truncate text-left">{vendor.name}</span>
          {vendor.storeSlug ? (
            <span className="max-w-[80px] truncate text-xs text-muted-foreground">
              {vendor.storeSlug}
            </span>
          ) : null}
        </DavinciDroplistItem>
      ))}
    </DavinciDroplist>
  )
}
