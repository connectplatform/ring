'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  DavinciDroplist,
  DavinciDroplistItem,
  DavinciDroplistTrigger,
} from '@/components/ui/davinci-droplist'

interface ProductCategoryDroplistProps {
  value: string
  onChange: (value: string) => void
  categories: readonly string[]
  labelFor: (slug: string) => string
  scopeLabel: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Searchable category picker. Opens an FsModal list instead of a clipped select popover. */
export function ProductCategoryDroplist({
  value,
  onChange,
  categories,
  labelFor,
  scopeLabel,
  placeholder,
  disabled,
  className,
}: ProductCategoryDroplistProps) {
  const t = useTranslations('common.davinciDroplist')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const options = useMemo(() => {
    const list = [...categories]
    if (value && !list.includes(value)) list.unshift(value)
    const needle = search.trim().toLowerCase()
    if (!needle) return list
    return list.filter((slug) => {
      const label = labelFor(slug).toLowerCase()
      return label.includes(needle) || slug.toLowerCase().includes(needle)
    })
  }, [categories, labelFor, search, value])

  return (
    <DavinciDroplist
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
      scopeLabel={scopeLabel}
      search={search}
      onSearchChange={setSearch}
      empty={options.length === 0}
      trigger={
        <DavinciDroplistTrigger
          open={open}
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn('w-full', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">
            {value ? labelFor(value) : placeholder || t('selectTitle', { scope: scopeLabel })}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </DavinciDroplistTrigger>
      }
    >
      {options.map((slug) => (
        <DavinciDroplistItem
          key={slug}
          selected={slug === value}
          onSelect={() => {
            onChange(slug)
            setSearch('')
            setOpen(false)
          }}
        >
          <span className="truncate">{labelFor(slug)}</span>
        </DavinciDroplistItem>
      ))}
    </DavinciDroplist>
  )
}

export default ProductCategoryDroplist
