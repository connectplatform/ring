'use client'

/**
 * CountrySelect — Davinci-droplist picker with IP auto-detect + timezone hook.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronsUpDown, Globe, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'
import { COUNTRIES_SORTED, getTimezoneForCountry, type Country } from '@/data/countries'

interface CountrySelectProps {
  value?: string
  onChange?: (countryCode: string) => void
  onTimezoneChange?: (timezone: string) => void
  autoDetect?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function CountrySelect({
  value,
  onChange,
  onTimezoneChange,
  autoDetect = true,
  placeholder,
  disabled = false,
  className,
}: CountrySelectProps) {
  const t = useTranslations('common.davinciDroplist')
  const tProfile = useTranslations('modules.profile')
  const [open, setOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectedOnce, setDetectedOnce] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const scopeLabel = t('scopes.country')
  const triggerPlaceholder = placeholder ?? tProfile('selectCountry')

  const selectedCountry = COUNTRIES_SORTED.find((c) => c.code === value)

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES_SORTED
    const query = searchQuery.toLowerCase()
    return COUNTRIES_SORTED.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query),
    )
  }, [searchQuery])

  const detectCountry = useCallback(async () => {
    if (!autoDetect || detectedOnce || value) return

    setDetecting(true)
    try {
      const services = [
        'https://ipapi.co/json/',
        'https://ip-api.com/json/?fields=countryCode,timezone',
      ]

      for (const service of services) {
        try {
          const response = await fetch(service, {
            signal: AbortSignal.timeout(5000),
          })

          if (response.ok) {
            const data = await response.json()
            const countryCode = data.country_code || data.countryCode || data.country

            if (countryCode && typeof countryCode === 'string') {
              const validCountry = COUNTRIES_SORTED.find(
                (c) => c.code.toUpperCase() === countryCode.toUpperCase(),
              )

              if (validCountry) {
                onChange?.(validCountry.code)
                const timezone = getTimezoneForCountry(validCountry.code)
                if (timezone) onTimezoneChange?.(timezone)
                setDetectedOnce(true)
                break
              }
            }
          }
        } catch {
          continue
        }
      }
    } catch {
      // ignore geoip failure
    } finally {
      setDetecting(false)
      setDetectedOnce(true)
    }
  }, [autoDetect, detectedOnce, value, onChange, onTimezoneChange])

  useEffect(() => {
    detectCountry()
  }, [detectCountry])

  const handleCountryChange = (countryCode: string) => {
    onChange?.(countryCode)
    const timezone = getTimezoneForCountry(countryCode)
    if (timezone) onTimezoneChange?.(timezone)
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
      empty={filteredCountries.length === 0}
      trigger={
        <DavinciDroplistTrigger
          open={open}
          onClick={() => setOpen(true)}
          disabled={disabled || detecting}
          className={cn(!value && 'text-muted-foreground', className)}
        >
          {detecting ? (
            <>
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('detecting')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : selectedCountry ? (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="truncate">{selectedCountry.name}</span>
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
      {filteredCountries.map((country) => (
        <DavinciDroplistItem
          key={country.code}
          selected={value === country.code}
          onSelect={() => handleCountryChange(country.code)}
        >
          <span className="text-lg">{country.flag}</span>
          <span className="flex-1 text-left">{country.name}</span>
          <span className="text-xs text-muted-foreground">{country.code}</span>
        </DavinciDroplistItem>
      ))}
    </DavinciDroplist>
  )
}

export { COUNTRIES_SORTED, getTimezoneForCountry, type Country } from '@/data/countries'
