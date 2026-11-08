'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import type { NovaPostCity, NovaPostWarehouse } from '@/lib/shipping/nova-post'

export interface NovaPostLocation {
  id: string
  name: string
  address: string
  externalId?: string
  settlementId?: string
  settlementName?: string
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
  const [branchQuery, setBranchQuery] = useState(selected?.name ?? '')
  const lockedBranchQuery = useRef(selected?.name?.trim() ?? '')
  const [branches, setBranches] = useState<NovaPostWarehouse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cityQuery.trim() || cityQuery.trim().length < 2 || city?.name === cityQuery.trim()) {
      setCities([])
      return
    }
    let cancelled = false
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
          if (cancelled) return
          if (!res.ok) {
            setError(data?.error === 'invalid_key' ? t('novaPostInvalidKey') : t('novaPostSearchFailed'))
            setCities([])
            return
          }
          setCities(Array.isArray(data.cities) ? data.cities : [])
        } catch {
          if (!cancelled) {
            setError(t('novaPostSearchFailed'))
            setCities([])
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [cityQuery, city?.name, t])

  useEffect(() => {
    if (!city?.ref) {
      setBranches([])
      return
    }
    const q = branchQuery.trim()
    if (q && q === lockedBranchQuery.current) {
      setBranches([])
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError(null)
        try {
          const params = new URLSearchParams({ cityRef: city.ref })
          if (q.length >= 1) params.set('q', q)
          const res = await fetch(`/api/shipping/novapost/warehouses?${params}`, { cache: 'no-store' })
          const data = await res.json()
          if (cancelled) return
          if (!res.ok) {
            setError(data?.error === 'invalid_key' ? t('novaPostInvalidKey') : t('novaPostSearchFailed'))
            setBranches([])
            return
          }
          setBranches(Array.isArray(data.warehouses) ? data.warehouses : [])
        } catch {
          if (!cancelled) {
            setError(t('novaPostSearchFailed'))
            setBranches([])
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [city?.ref, branchQuery, t])

  function pickCity(next: NovaPostCity) {
    setCity(next)
    setCityQuery(next.name)
    setCities([])
    lockedBranchQuery.current = ''
    setBranchQuery('')
    setBranches([])
    onSelect(null)
  }

  function pickBranch(branch: NovaPostWarehouse) {
    if (!city) return
    lockedBranchQuery.current = branch.name.trim()
    setBranchQuery(branch.name)
    setBranches([])
    onSelect({
      id: branch.ref,
      externalId: branch.ref,
      name: branch.name,
      address: branch.address,
      settlementId: city.ref,
      settlementName: city.name,
      settlement: { name: city.name, region: city.area ? { name: city.area } : undefined },
    })
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
          onChange={(event) => {
            const next = event.target.value
            if (next.trim() !== lockedBranchQuery.current) {
              lockedBranchQuery.current = ''
              if (selected) onSelect(null)
            }
            setBranchQuery(next)
          }}
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
                    <span className="mt-0.5 block text-sm text-muted-foreground">{branch.address}</span>
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
