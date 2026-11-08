'use client'

/**
 * City district picker. Options come from the composed city map
 * (`getCityDistrictCoordinates`). Hidden when the clone defines no districts.
 */

import React, { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'
import { getCityDistrictCoordinates } from '@/features/map/lib/baseline-city-pois'

export function listCityDistricts(): string[] {
  return Object.keys(getCityDistrictCoordinates()).sort((a, b) => a.localeCompare(b))
}

interface DistrictSelectProps {
  value?: string
  onChange: (district: string) => void
  disabled?: boolean
  className?: string
}

export function DistrictSelect({ value, onChange, disabled, className }: DistrictSelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const tProfile = useTranslations('modules.profile')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const districts = useMemo(() => listCityDistricts(), [])

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return districts
    return districts.filter((name) => name.toLowerCase().includes(query))
  }, [districts, searchQuery])

  if (districts.length === 0) return null

  return (
    <DavinciDroplist
      open={open}
      onOpenChange={setOpen}
      scopeLabel={t('scopes.district')}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      empty={filtered.length === 0}
      trigger={
        <DavinciDroplistTrigger
          open={open}
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn(!value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{value || tProfile('selectDistrict')}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </DavinciDroplistTrigger>
      }
    >
      {filtered.map((name) => (
        <DavinciDroplistItem
          key={name}
          selected={name === value}
          onSelect={() => {
            onChange(name)
            setSearchQuery('')
            setOpen(false)
          }}
        >
          {name}
        </DavinciDroplistItem>
      ))}
    </DavinciDroplist>
  )
}
