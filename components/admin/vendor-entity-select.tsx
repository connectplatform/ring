'use client'

import React, { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  placeholder = 'Select vendor',
  disabled = false,
  className,
}: VendorEntitySelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    setOpen(false)
    setSearchQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-11', !value && 'text-muted-foreground', className)}
          disabled={disabled}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Store className="h-4 w-4 shrink-0" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-[280px]">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No vendors found.</div>
          ) : (
            <div className="p-1">
              {filtered.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => handleSelect(vendor.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === vendor.id && 'bg-accent',
                  )}
                >
                  <Check
                    className={cn('h-4 w-4', value === vendor.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="flex-1 text-left truncate">{vendor.name}</span>
                  {vendor.storeSlug && (
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                      {vendor.storeSlug}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
