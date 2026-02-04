'use client'

/**
 * TimezoneSelect Component
 * 
 * A searchable popover component for selecting timezones with:
 * - Country-based filtering (shows relevant timezones first)
 * - Current time display for each timezone
 * - UTC offset display
 * - Searchable interface
 * - Accessible and keyboard navigable
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Check, ChevronsUpDown, Clock, Search, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getTimezonesForCountry,
  getTimezoneInfo,
  ALL_TIMEZONES,
  type TimezoneInfo,
} from '@/data/countries'

interface TimezoneSelectProps {
  value?: string
  onChange?: (timezoneId: string) => void
  countryCode?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function TimezoneSelect({
  value,
  onChange,
  countryCode,
  placeholder = 'Select timezone',
  disabled = false,
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const allTimezoneInfos = useMemo(() => {
    return ALL_TIMEZONES.map(tz => getTimezoneInfo(tz)).sort((a, b) => a.offsetMinutes - b.offsetMinutes)
  }, [])

  const countryTimezones = useMemo(() => {
    if (!countryCode) return []
    return getTimezonesForCountry(countryCode)
  }, [countryCode])

  const organizedTimezones = useMemo(() => {
    const countryTzSet = new Set(countryTimezones)
    return {
      country: allTimezoneInfos.filter(tz => countryTzSet.has(tz.id)),
      other: allTimezoneInfos.filter(tz => !countryTzSet.has(tz.id)),
    }
  }, [countryTimezones, allTimezoneInfos])

  const filteredTimezones = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filterFn = (tz: TimezoneInfo) => !query || tz.id.toLowerCase().includes(query) || tz.name.toLowerCase().includes(query) || tz.offset.toLowerCase().includes(query)
    return {
      country: organizedTimezones.country.filter(filterFn),
      other: organizedTimezones.other.filter(filterFn),
    }
  }, [searchQuery, organizedTimezones])

  const selectedTimezone = useMemo(() => value ? getTimezoneInfo(value) : null, [value])

  const formatTimeForTimezone = useCallback((timezoneId: string) => {
    try {
      return currentTime.toLocaleTimeString('en-US', { timeZone: timezoneId, hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return '--:--' }
  }, [currentTime])

  const handleTimezoneSelect = (timezoneId: string) => {
    onChange?.(timezoneId)
    setOpen(false)
    setSearchQuery('')
  }

  const renderTimezoneItem = (tz: TimezoneInfo) => (
    <button key={tz.id} onClick={() => handleTimezoneSelect(tz.id)} className={cn('flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground', value === tz.id && 'bg-accent')}>
      <Check className={cn('h-4 w-4 shrink-0', value === tz.id ? 'opacity-100' : 'opacity-0')} />
      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex flex-col items-start min-w-0">
          <span className="truncate font-medium">{tz.name}</span>
          <span className="text-xs text-muted-foreground">{tz.offset}</span>
        </div>
        <span className="text-xs text-muted-foreground ml-2 shrink-0 font-mono">{formatTimeForTimezone(tz.id)}</span>
      </div>
    </button>
  )

  const hasCountryTimezones = filteredTimezones.country.length > 0
  const hasOtherTimezones = filteredTimezones.other.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn('w-full justify-between h-11 md:h-10', !value && 'text-muted-foreground', className)} disabled={disabled}>
          {selectedTimezone ? (
            <span className="flex items-center gap-2 min-w-0">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedTimezone.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">({selectedTimezone.offset})</span>
            </span>
          ) : (
            <span className="flex items-center gap-2"><Globe className="h-4 w-4" />{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input placeholder="Search timezone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 border-0 p-0 shadow-none focus-visible:ring-0" />
        </div>
        <ScrollArea className="h-[350px]">
          {!hasCountryTimezones && !hasOtherTimezones ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No timezone found.</div>
          ) : (
            <div className="p-1">
              {hasCountryTimezones && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-0 bg-popover">{countryCode ? `${countryCode} Timezones` : 'Recommended'}</div>
                  {filteredTimezones.country.map(renderTimezoneItem)}
                </>
              )}
              {hasCountryTimezones && hasOtherTimezones && <div className="my-2 border-t" />}
              {hasOtherTimezones && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-0 bg-popover">All Timezones</div>
                  {filteredTimezones.other.map(renderTimezoneItem)}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export { getTimezonesForCountry, getTimezoneInfo, ALL_TIMEZONES } from '@/data/countries'
