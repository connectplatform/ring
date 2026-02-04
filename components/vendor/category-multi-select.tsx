'use client'

/**
 * Agricultural Store Categories Multi-Select
 * 
 * Checkbox grid for selecting store categories during vendor onboarding.
 * Based on Emperor Ray's examples: Organic Produce, Honey & Sweets, Essential Oils, etc.
 * 
 * Features:
 * - 12 agricultural categories with icons
 * - Multi-select checkboxes
 * - Responsive grid layout
 * - Agricultural theme styling
 * - Description tooltips
 */

import React, { useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CategoryMultiSelectProps {
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  error?: string
}

// Agricultural Categories (Emperor Ray's examples + extensions)
const STORE_CATEGORIES = [
  { id: 'organic-produce', icon: '🥬', colorClass: 'from-emerald-500/20 to-lime-500/20' },
  { id: 'honey-sweets', icon: '🍯', colorClass: 'from-amber-500/20 to-yellow-500/20' },
  { id: 'essential-oils', icon: '🌿', colorClass: 'from-green-500/20 to-emerald-500/20' },
  { id: 'dairy-eggs', icon: '🥛', colorClass: 'from-blue-500/20 to-cyan-500/20' },
  { id: 'meat-poultry', icon: '🍖', colorClass: 'from-red-500/20 to-orange-500/20' },
  { id: 'herbs-spices', icon: '🌱', colorClass: 'from-lime-500/20 to-green-500/20' },
  { id: 'grains-legumes', icon: '🌾', colorClass: 'from-yellow-500/20 to-amber-500/20' },
  { id: 'baked-goods', icon: '🍞', colorClass: 'from-orange-500/20 to-amber-500/20' },
  { id: 'preserves-pickles', icon: '🥒', colorClass: 'from-green-500/20 to-teal-500/20' },
  { id: 'beverages', icon: '🍵', colorClass: 'from-purple-500/20 to-indigo-500/20' },
  { id: 'nuts-seeds', icon: '🥜', colorClass: 'from-amber-500/20 to-orange-500/20' },
  { id: 'handmade-crafts', icon: '🧺', colorClass: 'from-pink-500/20 to-rose-500/20' }
]

export default function CategoryMultiSelect({ 
  selectedCategories, 
  onCategoriesChange, 
  error 
}: CategoryMultiSelectProps) {
  const t = useTranslations('vendor.onboarding.categories')

  // React 19 useTransition for non-blocking category selection updates
  const [isPending, startTransition] = useTransition()

  const handleToggle = useCallback((categoryId: string) => {
    startTransition(() => {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter(id => id !== categoryId)
        : [...selectedCategories, categoryId]

      onCategoriesChange(newSelection)
    })
  }, [selectedCategories, onCategoriesChange])

  return (
    <div className="space-y-3">
      {/* Grid of category cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {STORE_CATEGORIES.map((category, index) => {
          const isSelected = selectedCategories.includes(category.id)
          
          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <label
                className={cn(
                  "relative group cursor-pointer block",
                  "rounded-xl p-4",
                  "border-2 transition-all duration-300",
                  "bg-gradient-to-br backdrop-blur-sm",
                  isSelected 
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/20" 
                    : "border-border hover:border-emerald-300 hover:shadow-md",
                  category.colorClass
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  {/* Icon */}
                  <div className={cn(
                    "text-3xl transition-transform duration-300",
                    isSelected ? "scale-110" : "group-hover:scale-105"
                  )}>
                    {category.icon}
                  </div>
                  
                  {/* Category name */}
                  <span className={cn(
                    "text-sm font-medium text-center leading-tight",
                    isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                  )}>
                    {t(category.id)}
                  </span>
                  
                  {/* Checkbox (hidden but functional) */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(category.id)}
                    className="sr-only"
                  />
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  )}
                </div>
              </label>
            </motion.div>
          )
        })}
      </div>

      {/* Selection count */}
      <div className="text-sm text-muted-foreground text-center">
        {selectedCategories.length > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
          </span>
        ) : (
          <span>Select at least one category</span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}

