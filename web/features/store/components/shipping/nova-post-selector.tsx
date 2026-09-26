'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import type { NovaPostCity, NovaPostWarehouse } from '@/lib/shipping/nova-post'

export interface NovaPostLocation {
  id: string
  name: string
  address: string
  externalId?: string
  settlement?: { name: string; region?: { name: string } }
}

type Props = {
  selected: NovaPostLocation | null
  onSelect: (loc: NovaPostLocation | null) => void
}

export function NovaPostSelector({ selected, onSelect }: Props) {
  const t = useTranslations('modules.store.checkout')
  const [cityQuery, setCityQuery] = useState(selected?.settlement?.name ?? '')
  const [city, setCity] = useState<NovaPostCity | null>(
    selected?.settlement?.name
      ? { ref: '', name: selected.settlement.name, area: '' }
      : null,
  )
  const [cities, setCities] = useState<NovaPostCity[]>([])
  const [branchQuery, setBranchQuery] = useState('')
  const [branches, setBranches] = useState<NovaPostWarehouse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cityQuery.trim() || cityQuery.trim().length < 2 || city?.name === cityQuery.trim()) {
      setCities([])
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError(null)
        try {
          const res = await fetch(
            `/api/shipping/novapost/cities?q=${encodeURIComponent(cityQuery.trim())}`,
            { cache: 'no-store' },
          )
          const data = await res.json()
          if (!res.ok) {
            setError(data?.error === 'invalid_key' ? t('novaPostInvalidKey') : t('novaPostSearchFailed'))
            setCities([])
            return
          }
          setCities(Array.isArray(data.cities) ? data.cities : [])
        } catch {
          setError(t('novaPostSearchFailed'))
          setCities([])
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(handle)
  }, [cityQuery, city?.name, t])

  useEffect(() => {
    if (!city?.ref) {
      setBranches([])
      return
    }
    const q = branchQuery.trim()
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError(null)
        try {
          const params = new URLSearchParams({ cityRef: city.ref })
          if (q.length >= 2) params.set('q', q)
          const res = await fetch(`/api/shipping/novapost/warehouses?${params}`, { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) {
            setError(data?.error === 'invalid_key' ? t('novaPostInvalidKey') : t('novaPostSearchFailed'))
            setBranches([])
            return
          }
          setBranches(Array.isArray(data.warehouses) ? data.warehouses : [])
        } catch {
          setError(t('novaPostSearchFailed'))
          setBranches([])
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(handle)
  }, [city?.ref, branchQuery, t])

  function pickCity(next: NovaPostCity) {
    setCity(next)
    setCityQuery(next.name)
    setCities([])
    setBranchQuery('')
    setBranches([])
    onSelect(null)
  }

  function pickBranch(branch: NovaPostWarehouse) {
    if (!city) return
    onSelect({
      id: branch.ref,
      externalId: branch.ref,
      name: branch.name,
      address: branch.address,
      settlement: { name: city.name, region: city.area ? { name: city.area } : undefined },
    })
    setBranches([])
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="nova-post-city">
          {t('novaPostCityLabel')}
        </label>
        <Input
          id="nova-post-city"
          value={cityQuery}
          autoComplete="off"
          placeholder={t('novaPostCityPlaceholder')}
          onChange={(event) => {
            setCityQuery(event.target.value)
            setCity(null)
            onSelect(null)
          }}
        />
        {cities.length > 0 ? (
          <ul className="max-h-48 overflow-auto rounded-md border bg-background">
            {cities.map((item) => (
              <li key={item.ref}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => pickCity(item)}
                >
                  {item.name}
                  {item.area ? <span className="text-muted-foreground"> · {item.area}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="nova-post-branch">
          {t('novaPostBranchLabel')}
        </label>
        <Input
          id="nova-post-branch"
          value={branchQuery}
          autoComplete="off"
          disabled={!city?.ref}
          placeholder={t('novaPostBranchPlaceholder')}
          onChange={(event) => setBranchQuery(event.target.value)}
        />
        {branches.length > 0 ? (
          <ul className="max-h-56 overflow-auto rounded-md border bg-background">
            {branches.map((branch) => (
              <li key={branch.ref}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => pickBranch(branch)}
                >
                  <span className="font-medium">{branch.name}</span>
                  {branch.address && branch.address !== branch.name ? (
                    <span className="block text-xs text-muted-foreground">{branch.address}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {loading ? <p className="text-xs text-muted-foreground">{t('novaPostLoading')}</p> : null}
    </div>
  )
}
