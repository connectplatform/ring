'use client'
import React, { useEffect, useMemo, useState } from 'react'

export interface NovaPostLocation {
  id: string | number
  name: string
  address: string
  settlement?: { name: string; region?: { name: string; parent?: { name: string } } }
  externalId?: string
}

export function NovaPostSelector({ selected, onSelect }: { selected: NovaPostLocation | null, onSelect: (loc: NovaPostLocation | null) => void }) {
  const [city, setCity] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [cities, setCities] = useState<string[]>([])
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadCities() {
      setLoading(true)
      setError(null)
      try {
        // NovaPoshta test cities API (public demo or proxy expected). Replace with env-based proxy in production.
        const res = await fetch('/api/shipping/novapost/cities', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load cities')
        const data = await res.json()
        if (!cancelled) setCities(data.cities || [])
      } catch (e: any) {
        if (!cancelled) {
          setError('Failed to load cities')
          setCities(['Cherkasy', 'Kyiv'])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadCities()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadWarehouses() {
      if (!city) { setWarehouses([]); return }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/shipping/novapost/warehouses?city=${encodeURIComponent(city)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load warehouses')
        const data = await res.json()
        if (!cancelled) setWarehouses(data.warehouses || [])
      } catch (e: any) {
        if (!cancelled) {
          setError('Failed to load warehouses')
          setWarehouses([`${city} Warehouse #1`, `${city} Warehouse #2`])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadWarehouses()
    return () => { cancelled = true }
  }, [city])

  useEffect(() => {
    if (city && warehouse) {
      onSelect({ id: `${city}-${warehouse}`, name: warehouse, address: warehouse, settlement: { name: city } })
    } else {
      onSelect(null)
    }
  }, [city, warehouse, onSelect])

  return (
    <div className="space-y-2">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <select className="border rounded px-3 py-2 w-full" value={city} onChange={e => setCity(e.target.value)}>
        <option value="">Select city</option>
        {cities.map(c => (<option key={c} value={c}>{c}</option>))}
      </select>
      <select className="border rounded px-3 py-2 w-full" value={warehouse} onChange={e => setWarehouse(e.target.value)} disabled={!city}>
        <option value="">Select warehouse</option>
        {warehouses.map(w => (<option key={w} value={w}>{w}</option>))}
      </select>
      {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
    </div>
  )
}


