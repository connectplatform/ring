'use client'

/**
 * CountrySelect Component
 * 
 * A dropdown component for selecting a country with:
 * - IP-based country auto-detection
 * - Automatic timezone selection based on country
 * - Searchable dropdown with flags
 * - Accessible and keyboard navigable
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, ChevronsUpDown, Globe, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { COUNTRIES_SORTED, getTimezoneForCountry, type Country } from '@/data/countries'

interface CountrySelectProps {
  value?: string // Country code (e.g., 'UA')
  onChange?: (countryCode: string) => void
  onTimezoneChange?: (timezone: string) => void // Called when country changes to auto-set timezone
  autoDetect?: boolean // Enable IP-based country detection
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function CountrySelect({
  value,
  onChange,
  onTimezoneChange,
  autoDetect = true,
  placeholder = 'Select country',
  disabled = false,
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectedOnce, setDetectedOnce] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Find selected country
  const selectedCountry = COUNTRIES_SORTED.find((c) => c.code === value)

  // Filter countries based on search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES_SORTED
    const query = searchQuery.toLowerCase()
    return COUNTRIES_SORTED.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // IP-based country detection
  const detectCountry = useCallback(async () => {
    if (!autoDetect || detectedOnce || value) return
    
    setDetecting(true)
    try {
      // Try multiple free GeoIP services
      const services = [
        'https://ipapi.co/json/',
        'https://ip-api.com/json/?fields=countryCode,timezone',
      ]
      
      for (const service of services) {
        try {
          const response = await fetch(service, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
          })
          
          if (response.ok) {
            const data = await response.json()
            const countryCode = data.country_code || data.countryCode || data.country
            
            if (countryCode && typeof countryCode === 'string') {
              const validCountry = COUNTRIES_SORTED.find(
                (c) => c.code.toUpperCase() === countryCode.toUpperCase()
              )
              
              if (validCountry) {
                console.log('CountrySelect: Auto-detected country:', validCountry.name)
                onChange?.(validCountry.code)
                
                // Auto-set timezone based on detected country
                const timezone = getTimezoneForCountry(validCountry.code)
                if (timezone) {
                  onTimezoneChange?.(timezone)
                }
                
                setDetectedOnce(true)
                break
              }
            }
          }
        } catch (serviceError) {
          console.warn('CountrySelect: GeoIP service failed:', serviceError)
          continue // Try next service
        }
      }
    } catch (error) {
      console.warn('CountrySelect: Country detection failed:', error)
    } finally {
      setDetecting(false)
      setDetectedOnce(true)
    }
  }, [autoDetect, detectedOnce, value, onChange, onTimezoneChange])

  // Auto-detect on mount if enabled and no value
  useEffect(() => {
    detectCountry()
  }, [detectCountry])

  // When country changes, update timezone
  const handleCountryChange = (countryCode: string) => {
    onChange?.(countryCode)
    
    // Auto-set timezone based on selected country
    const timezone = getTimezoneForCountry(countryCode)
    if (timezone) {
      onTimezoneChange?.(timezone)
    }
    
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
          className={cn(
            'w-full justify-between h-11 md:h-10',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled || detecting}
        >
          {detecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Detecting...
            </>
          ) : selectedCountry ? (
            <span className="flex items-center gap-2">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="truncate">{selectedCountry.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {filteredCountries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No country found.
            </div>
          ) : (
            <div className="p-1">
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountryChange(country.code)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground',
                    value === country.code && 'bg-accent'
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      value === country.code ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-left">{country.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {country.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// Re-export for convenience
export { COUNTRIES_SORTED, getTimezoneForCountry, type Country } from '@/data/countries'
