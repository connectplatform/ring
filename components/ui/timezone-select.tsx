'use client'

/**
 * TimezoneSelect — Davinci-droplist with country-prioritized zones + live clock.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronsUpDown, Clock, Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'
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
  placeholder,
  disabled = false,
  className,
}: TimezoneSelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const tProfile = useTranslations('modules.profile')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  const scopeLabel = t('scopes.timezone')
  const triggerPlaceholder = placeholder ?? tProfile('selectTimezone')

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const allTimezoneInfos = useMemo(
    () =>
      ALL_TIMEZONES.map((tz) => getTimezoneInfo(tz)).sort(
        (a, b) => a.offsetMinutes - b.offsetMinutes,
      ),
    [],
  )

  const countryTimezones = useMemo(() => {
    if (!countryCode) return []
    return getTimezonesForCountry(countryCode)
  }, [countryCode])

  const organizedTimezones = useMemo(() => {
    const countryTzSet = new Set(countryTimezones)
    return {
      country: allTimezoneInfos.filter((tz) => countryTzSet.has(tz.id)),
      other: allTimezoneInfos.filter((tz) => !countryTzSet.has(tz.id)),
    }
  }, [countryTimezones, allTimezoneInfos])

  const filteredTimezones = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filterFn = (tz: TimezoneInfo) =>
      !query ||
      tz.id.toLowerCase().includes(query) ||
      tz.name.toLowerCase().includes(query) ||
      tz.offset.toLowerCase().includes(query)
    return {
      country: organizedTimezones.country.filter(filterFn),
      other: organizedTimezones.other.filter(filterFn),
    }
  }, [searchQuery, organizedTimezones])

  const selectedTimezone = useMemo(
    () => (value ? getTimezoneInfo(value) : null),
    [value],
  )

  const formatTimeForTimezone = useCallback(
    (timezoneId: string) => {
      try {
        return currentTime.toLocaleTimeString('en-US', {
          timeZone: timezoneId,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      } catch {
        return '--:--'
      }
    },
    [currentTime],
  )

  const handleTimezoneSelect = (timezoneId: string) => {
    onChange?.(timezoneId)
    setSearchQuery('')
    setOpen(false)
  }

  const hasCountryTimezones = filteredTimezones.country.length > 0
  const hasOtherTimezones = filteredTimezones.other.length > 0
  const empty = !hasCountryTimezones && !hasOtherTimezones

  const renderTimezoneItem = (tz: TimezoneInfo) => (
    <DavinciDroplistItem
      key={tz.id}
      selected={value === tz.id}
      onSelect={() => handleTimezoneSelect(tz.id)}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium">{tz.name}</span>
          <span className="text-xs text-muted-foreground">{tz.offset}</span>
        </div>
        <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
          {formatTimeForTimezone(tz.id)}
        </span>
      </div>
    </DavinciDroplistItem>
  )

  return (
    <DavinciDroplist
      open={open}
      onOpenChange={setOpen}
      scopeLabel={scopeLabel}
      search={searchQuery}
      onSearchChange={setSearchQuery}
      empty={empty}
      trigger={
        <DavinciDroplistTrigger
          open={open}
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn(!value && 'text-muted-foreground', className)}
        >
          {selectedTimezone ? (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedTimezone.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ({selectedTimezone.offset})
                </span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {triggerPlaceholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </DavinciDroplistTrigger>
      }
    >
      {hasCountryTimezones && (
        <>
          <div className="sticky top-0 bg-background px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {countryCode ? `${countryCode}` : '★'}
          </div>
          {filteredTimezones.country.map(renderTimezoneItem)}
        </>
      )}
      {hasCountryTimezones && hasOtherTimezones && (
        <div className="my-2 border-t" />
      )}
      {hasOtherTimezones && (
        <>
          {hasCountryTimezones ? (
            <div className="sticky top-0 bg-background px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              UTC
            </div>
          ) : null}
          {filteredTimezones.other.map(renderTimezoneItem)}
        </>
      )}
    </DavinciDroplist>
  )
}

export { getTimezonesForCountry, getTimezoneInfo, ALL_TIMEZONES } from '@/data/countries'
