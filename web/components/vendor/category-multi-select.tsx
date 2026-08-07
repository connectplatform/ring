'use client'

/**
 * Store category multi-select — calculator-style Lucide tiles (DaVinci accents).
 */

import React, { useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import {
  STORE_VENDOR_CATEGORY_IDS,
  STORE_VENDOR_CATEGORY_META,
} from '@/constants/store-vendor-categories'

interface CategoryMultiSelectProps {
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  error?: string
}

export default function CategoryMultiSelect({
  selectedCategories,
  onCategoriesChange,
  error,
}: CategoryMultiSelectProps) {
  const t = useTranslations('modules.store')
  const tForm = useTranslations('vendor.onboarding.form')

  const [isPending, startTransition] = useTransition()

  const handleToggle = useCallback(
    (categoryId: string) => {
      startTransition(() => {
        const newSelection = selectedCategories.includes(categoryId)
          ? selectedCategories.filter((id) => id !== categoryId)
          : [...selectedCategories, categoryId]

        onCategoriesChange(newSelection)
      })
    },
    [selectedCategories, onCategoriesChange],
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {STORE_VENDOR_CATEGORY_IDS.map((categoryId, index) => {
          const category = STORE_VENDOR_CATEGORY_META[categoryId]
          const Icon = category.LucideIcon
          const isSelected = selectedCategories.includes(categoryId)
          const color = category.accent

          return (
            <motion.div
              key={categoryId}
              className="h-full"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
            >
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggle(categoryId)}
                aria-pressed={isSelected}
                className={cn(
                  'flex h-full min-h-[7.5rem] w-full flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
                  'hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected ? cn(davinciGlassSurface, 'shadow-sm') : 'border-border/80 bg-background/60',
                )}
                style={
                  isSelected
                    ? {
                        borderColor: color,
                        backgroundColor: category.soft,
                        boxShadow: `0 0 0 1px ${color}33, 0 8px 24px -12px ${color}66`,
                      }
                    : { borderColor: `${color}33` }
                }
              >
                <div className="flex w-full shrink-0 items-start justify-between gap-2">
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                      isSelected ? 'border-transparent' : 'border-border text-muted-foreground',
                    )}
                    style={
                      isSelected
                        ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
                        : { color }
                    }
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  </div>
                  {isSelected ? (
                    <CheckCircle className="size-4 shrink-0" style={{ color }} />
                  ) : null}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">
                  {t(`categories.${categoryId}`)}
                </div>
              </button>
            </motion.div>
          )
        })}
      </div>

      <div className="text-sm text-muted-foreground text-center">
        {selectedCategories.length > 0 ? (
          <span className="text-primary font-medium">
            {tForm('categoriesSelected', { count: selectedCategories.length })}
          </span>
        ) : (
          <span>{tForm('categoriesSelectHint')}</span>
        )}
      </div>

      {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}
    </div>
  )
}
