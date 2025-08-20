'use client'
import React, { useMemo } from 'react'
import { useTranslations } from 'next-intl'

export type SortKey = 'name' | 'price'
export type SortDir = 'asc' | 'desc'

export function FilterBar({
  search,
  setSearch,
  currency,
  setCurrency,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir
}: {
  search: string
  setSearch: (v: string) => void
  currency: '' | 'DAAR' | 'DAARION'
  setCurrency: (v: '' | 'DAAR' | 'DAARION') => void
  sortKey: SortKey
  setSortKey: (v: SortKey) => void
  sortDir: SortDir
  setSortDir: (v: SortDir) => void
}) {
  const t = useTranslations('modules.store')
  const options = useMemo(() => ([
    { key: 'name', label: t('sortByName') },
    { key: 'price', label: t('sortByPrice') }
  ] as const), [t])

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <input
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="border rounded px-3 py-2 min-w-[220px]"
      />
      <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="border rounded px-3 py-2">
        <option value="">{t('allCurrencies')}</option>
        <option value="DAAR">DAAR</option>
        <option value="DAARION">DAARION</option>
      </select>
      <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="border rounded px-3 py-2">
        {options.map(o => (<option key={o.key} value={o.key}>{o.label}</option>))}
      </select>
      <select value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)} className="border rounded px-3 py-2">
        <option value="asc">{t('sortAsc')}</option>
        <option value="desc">{t('sortDesc')}</option>
      </select>
    </div>
  )
}


