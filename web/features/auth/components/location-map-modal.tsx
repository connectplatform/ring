'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { Loader2, MapPin, Search, X } from 'lucide-react'

// Leaflet CSS - static import is safe (Next.js extracts CSS at build time, no window access)
import 'leaflet/dist/leaflet.css'

// Leaflet JS is dynamically imported client-side only (SSR-safe)
type LeafletInstance = typeof import('leaflet')
let leafletPromise: Promise<LeafletInstance> | null = null
const getLeaflet = (): Promise<LeafletInstance> => {
  if (!leafletPromise) {
    leafletPromise = import('leaflet').then((mod) => {
      const L: LeafletInstance = (mod as any).default || mod
      // Fix Leaflet default marker icons (bundler compat)
      delete (L as any).Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })
      return L
    })
  }
  return leafletPromise
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  type: string
  importance: number
}

interface LocationMapModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLocation?: { address: string; lat: number; lng: number } | null
  onLocationSaved?: (location: { address: string; lat: number; lng: number }) => void
}

/**
 * Location Map Modal
 * - Fullscreen mobile, centered dialog desktop
 * - Address search with Nominatim autocomplete suggestions
 * - Draggable map pin using Leaflet + OpenStreetMap (loaded dynamically, SSR-safe)
 * - Saves location via updateProfile cultural field
 */
export default function LocationMapModal({
  open,
  onOpenChange,
  currentLocation,
  onLocationSaved,
}: LocationMapModalProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const router = useRouter()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<{ map: any; marker: any } | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const leafletLoadedRef = useRef(false)

  const [address, setAddress] = useState(currentLocation?.address || '')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number
    lng: number
    address: string
  } | null>(currentLocation || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leafletReady, setLeafletReady] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAddress(currentLocation?.address || '')
      setSelectedLocation(currentLocation || null)
      setSaving(false)
      setError(null)
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [open, currentLocation])

  // Dynamically load Leaflet JS on mount + inject CSS fallback
  useEffect(() => {
    if (leafletLoadedRef.current) return
    leafletLoadedRef.current = true

    // Safety net: inject CSS via link if static import didn't apply
    if (!document.getElementById('leaflet-css-fallback')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css-fallback'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    getLeaflet().then(() => {
      setLeafletReady(true)
    })
  }, [])

  // Initialize map once Leaflet is ready and modal is open
  useEffect(() => {
    if (!open || !leafletReady || !mapContainerRef.current) return
    if (mapInstanceRef.current) return // already initialized

    const initMap = async () => {
      const L = await getLeaflet()

      const coords = selectedLocation
        ? [selectedLocation.lat, selectedLocation.lng]
        : [50.4501, 30.5234] // Default: Kyiv

      const map = L.map(mapContainerRef.current, {
        center: coords as [number, number],
        zoom: selectedLocation ? 13 : 5,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker(coords as [number, number], {
        draggable: true,
      }).addTo(map)

      marker.on('dragend', async () => {
        const pos = marker.getLatLng()
        setSelectedLocation((prev) => ({
          lat: pos.lat,
          lng: pos.lng,
          address: prev?.address || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
        }))
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&addressdetails=1`
          )
          const data = await response.json()
          if (data.display_name) {
            setAddress(data.display_name)
            setSelectedLocation({
              lat: pos.lat,
              lng: pos.lng,
              address: data.display_name,
            })
          }
        } catch {
          // ignore reverse geocode errors on drag
        }
      })

      mapInstanceRef.current = { map, marker }

      // Use ResizeObserver to fix map sizing after dialog animation completes
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize()
      })
      resizeObserver.observe(mapContainerRef.current)

      // Also do a delayed invalidateSize as fallback
      const timeoutId = setTimeout(() => map.invalidateSize(), 600)

      // Store for cleanup
      ;(map as any).__resizeObserver = resizeObserver
      ;(map as any).__timeoutId = timeoutId
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        const m = mapInstanceRef.current.map
        // Clean up ResizeObserver and timeout
        clearTimeout((m as any).__timeoutId)
        if ((m as any).__resizeObserver) {
          ;(m as any).__resizeObserver.disconnect()
        }
        m.remove()
        mapInstanceRef.current = null
      }
    }
  }, [open, leafletReady])

  // Search address via Nominatim
  const searchAddress = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      )
      const data: NominatimResult[] = await response.json()
      setSuggestions(data)
      setShowSuggestions(data.length > 0)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounced search
  const handleAddressInput = (value: string) => {
    setAddress(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (value.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    searchTimeoutRef.current = setTimeout(() => searchAddress(value), 400)
  }

  // Select a suggestion from the dropdown
  const handleSelectSuggestion = async (result: NominatimResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    setAddress(result.display_name)
    setSelectedLocation({ lat, lng, address: result.display_name })
    setShowSuggestions(false)
    setSuggestions([])

    // Move map marker
    if (mapInstanceRef.current) {
      await getLeaflet() // ensure loaded
      const { map, marker } = mapInstanceRef.current
      marker.setLatLng([lat, lng])
      map.setView([lat, lng], 13)
    }
  }

  // Fly to current geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        if (mapInstanceRef.current) {
          const { map, marker } = mapInstanceRef.current
          marker.setLatLng([lat, lng])
          map.setView([lat, lng], 13)
        }
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
          )
          const data = await response.json()
          const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setAddress(addr)
          setSelectedLocation({ lat, lng, address: addr })
        } catch {
          setSelectedLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
        }
      },
      () => {
        // Geolocation denied or failed - ignore
      }
    )
  }

  const handleSave = async () => {
    if (!selectedLocation) return

    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      // Store location in cultural JSONB as address object
      const cultural = {
        address: selectedLocation.address,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      }
      formData.append('cultural', JSON.stringify(cultural))

      const { updateProfile } = await import('@/app/_actions/profile')
      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        await updateSession()
        router.refresh()
        onLocationSaved?.(selectedLocation)
        onOpenChange(false)
      } else {
        setError(result.message || 'Failed to save location')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    selectedLocation &&
    (selectedLocation.address !== (currentLocation?.address || '') ||
      selectedLocation.lat !== (currentLocation?.lat || 0) ||
      selectedLocation.lng !== (currentLocation?.lng || 0))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-sm:min-h-screen max-sm:rounded-none max-sm:pt-12 p-0 gap-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('selectLocation') || 'Select preferred location'}
            </DialogTitle>
            <DialogDescription>
              {t('selectLocationDescription') || 'Search for your location or drag the pin on the map'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {error && (
          <div className="px-6 pt-2">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {/* Address search */}
        <div className="px-6 pt-4 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={address}
              onChange={(e) => handleAddressInput(e.target.value)}
              placeholder={t('searchAddress') || 'Search for an address...'}
              className="pl-9 pr-8"
            />
            {address && (
              <button
                onClick={() => {
                  setAddress('')
                  setSuggestions([])
                  setShowSuggestions(false)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[1000] left-6 right-6 top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSuggestion(result)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-b-0 flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {searching && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Map container */}
        <div className="px-6 pt-3 pb-6">
          <div
            ref={mapContainerRef}
            className="w-full h-[350px] sm:h-[400px] min-h-[200px] rounded-lg border z-0 bg-muted/30"
            style={{ cursor: 'grab' }}
          >
            {!leafletReady && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('loadingMap') || 'Loading map...'}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {selectedLocation
              ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
              : t('dragPinToSetLocation') || 'Drag the pin to set your location'}
          </p>
        </div>

        <DialogFooter className="px-6 pb-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDetectLocation}
            disabled={saving}
            className="mr-auto"
          >
            <MapPin className="w-4 h-4 mr-1" />
            {t('useMyLocation') || 'Use my location'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedLocation || !hasChanges || saving}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />{t('saving') || 'Saving...'}</>
            ) : (
              t('save') || 'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
