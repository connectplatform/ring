'use client'

/**
 * Store category multi-select for vendor onboarding (Ring Marketplace categories).
 */

import React, { useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
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
      {/* Grid of category cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {STORE_VENDOR_CATEGORY_IDS.map((categoryId, index) => {
          const category = STORE_VENDOR_CATEGORY_META[categoryId]
          const isSelected = selectedCategories.includes(categoryId)

          return (
            <motion.div
              key={categoryId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <label
                className={cn(
                  'relative group cursor-pointer block',
                  'rounded-xl p-4',
                  'border-2 transition-all duration-300',
                  'bg-gradient-to-br backdrop-blur-sm',
                  isSelected
                    ? 'border-primary shadow-lg shadow-primary/20'
                    : 'border-border hover:border-primary/40 hover:shadow-md',
                  category.colorClass,
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      'text-3xl transition-transform duration-300',
                      isSelected ? 'scale-110' : 'group-hover:scale-105',
                    )}
                  >
                    {category.icon}
                  </div>

                  <span
                    className={cn(
                      'text-sm font-medium text-center leading-tight',
                      isSelected ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {t(`categories.${categoryId}`)}
                  </span>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(categoryId)}
                    className="sr-only"
                    disabled={isPending}
                  />

                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                    >
                      <span className="text-primary-foreground text-xs">✓</span>
                    </motion.div>
                  )}
                </div>
              </label>
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

      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  )
}
