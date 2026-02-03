'use client'

/**
 * Product Variant Selector - BADASS Edition
 * 
 * Features that Shopify wishes they had:
 * • Visual color swatches with hover effects
 * • Size selector with stock indicators
 * • Material/finish selector
 * • Real-time price updates
 * • Stock tracking per variant
 * • Smooth animations
 * • Touch-optimized for mobile
 */

import { useState, useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VariantOption {
  value: string
  label: string
  available: boolean
  stock?: number
  priceModifier?: number // Additional cost for this variant
  colorHex?: string // For color variants
  image?: string // Optional image for the variant
}

interface VariantType {
  name: string // e.g., "Size", "Color", "Material"
  options: VariantOption[]
}

interface ProductVariantSelectorProps {
  variants: VariantType[]
  basePrice: number
  currency: string
  onVariantChange: (selectedVariants: Record<string, string>, finalPrice: number) => void
  className?: string
}

export default function ProductVariantSelector({
  variants,
  basePrice,
  currency,
  onVariantChange,
  className
}: ProductVariantSelectorProps) {
  // Initialize with first available option for each variant type
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    variants.forEach(variant => {
      const firstAvailable = variant.options.find(opt => opt.available)
      if (firstAvailable) {
        initial[variant.name] = firstAvailable.value
      }
    })
    return initial
  })

  // Calculate final price based on selected variants
  const finalPrice = variants.reduce((price, variant) => {
    const selectedOption = variant.options.find(
      opt => opt.value === selectedVariants[variant.name]
    )
    return price + (selectedOption?.priceModifier || 0)
  }, basePrice)

  // Notify parent of changes
  useEffect(() => {
    onVariantChange(selectedVariants, finalPrice)
  }, [selectedVariants, finalPrice])

  const handleVariantSelect = (variantName: string, optionValue: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [variantName]: optionValue
    }))
  }

  // Get current selection for a variant type
  const getSelectedOption = (variant: VariantType): VariantOption | undefined => {
    return variant.options.find(opt => opt.value === selectedVariants[variant.name])
  }

  return (
    <div className={cn("space-y-6", className)}>
      {variants.map((variant) => {
        const selectedOption = getSelectedOption(variant)
        const isColorVariant = variant.name.toLowerCase().includes('color')

        return (
          <div key={variant.name}>
            {/* Variant Type Header */}
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-sm font-semibold">
                {variant.name}:
                {selectedOption && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {selectedOption.label}
                  </span>
                )}
              </label>
              {selectedOption && selectedOption.stock !== undefined && (
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  selectedOption.stock > 10
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : selectedOption.stock > 0
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {selectedOption.stock > 0 ? `${selectedOption.stock} left` : 'Out of stock'}
                </span>
              )}
            </div>

            {/* Variant Options */}
            <div className={cn(
              "flex flex-wrap gap-2",
              isColorVariant && "gap-3"
            )}>
              {variant.options.map((option) => {
                const isSelected = selectedVariants[variant.name] === option.value
                const isAvailable = option.available

                // Color variant rendering
                if (isColorVariant && option.colorHex) {
                  return (
                    <button
                      key={option.value}
                      onClick={() => isAvailable && handleVariantSelect(variant.name, option.value)}
                      disabled={!isAvailable}
                      className={cn(
                        "relative group",
                        !isAvailable && "cursor-not-allowed opacity-40"
                      )}
                      aria-label={`${variant.name}: ${option.label}`}
                      title={option.label}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full border-2 transition-all duration-200",
                        isSelected
                          ? "border-primary ring-4 ring-primary/20 scale-110"
                          : "border-border group-hover:border-primary/50 group-hover:scale-105"
                      )}>
                        <div
                          className="w-full h-full rounded-full"
                          style={{ backgroundColor: option.colorHex }}
                        />
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-lg">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      )}
                      {!isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-1 h-12 bg-red-500 rotate-45"></div>
                        </div>
                      )}
                    </button>
                  )
                }

                // Regular variant rendering (size, material, etc.)
                return (
                  <button
                    key={option.value}
                    onClick={() => isAvailable && handleVariantSelect(variant.name, option.value)}
                    disabled={!isAvailable}
                    className={cn(
                      "relative px-4 py-2.5 rounded-lg border-2 font-medium text-sm transition-all duration-200 min-w-[60px]",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                        : isAvailable
                        ? "border-border hover:border-primary/50 hover:scale-105 hover:shadow-sm"
                        : "border-border opacity-40 cursor-not-allowed",
                      "group"
                    )}
                    aria-label={`${variant.name}: ${option.label}`}
                  >
                    <span className="relative z-10">{option.label}</span>
                    
                    {/* Stock indicator for non-color variants */}
                    {option.stock !== undefined && option.stock <= 5 && option.stock > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {!isAvailable && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
                        <span className="text-xs font-semibold text-destructive">
                          Out
                        </span>
                      </div>
                    )}

                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* Price modifier indicator */}
                    {option.priceModifier && option.priceModifier !== 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {option.priceModifier > 0 ? '+' : ''}{option.priceModifier} {currency}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Price Display */}
      {finalPrice !== basePrice && (
        <div className="pt-4 border-t">
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-muted-foreground line-through">
              {basePrice} {currency}
            </span>
            <span className="text-2xl font-bold text-primary">
              {finalPrice} {currency}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

