'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StarRatingProps {
  /** Current rating value (0-5) */
  value?: number
  /** Maximum number of stars */
  maxStars?: number
  /** Whether the rating is interactive */
  interactive?: boolean
  /** Size of the stars */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Callback when rating changes (interactive mode only) */
  onRatingChange?: (rating: number) => void
  /** Callback when rating is submitted (interactive mode only) */
  onRatingSubmit?: (rating: number) => void
  /** Whether to show the numeric value */
  showValue?: boolean
  /** Whether to show half stars */
  allowHalf?: boolean
  /** Custom class name */
  className?: string
  /** Disabled state */
  disabled?: boolean
  /** Loading state */
  loading?: boolean
  /** Custom labels for each star rating */
  labels?: string[]
  /** ARIA label for the rating */
  ariaLabel?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
}

const defaultLabels = [
  'Terrible',
  'Poor', 
  'Average',
  'Good',
  'Excellent'
]

export function StarRating({
  value = 0,
  maxStars = 5,
  interactive = false,
  size = 'md',
  onRatingChange,
  onRatingSubmit,
  showValue = false,
  allowHalf = false,
  className,
  disabled = false,
  loading = false,
  labels = defaultLabels,
  ariaLabel
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [isHovering, setIsHovering] = useState(false)

  // Memoize the display rating to avoid unnecessary recalculations
  const displayRating = useMemo(() => {
    if (interactive && isHovering) {
      return hoverRating
    }
    return value
  }, [interactive, isHovering, hoverRating, value])

  // Handle mouse enter on star
  const handleMouseEnter = useCallback((starIndex: number) => {
    if (!interactive || disabled || loading) return
    
    const rating = allowHalf ? starIndex + 0.5 : starIndex + 1
    setHoverRating(rating)
    setIsHovering(true)
  }, [interactive, disabled, loading, allowHalf])

  // Handle mouse leave from star container
  const handleMouseLeave = useCallback(() => {
    if (!interactive || disabled || loading) return
    
    setIsHovering(false)
    setHoverRating(0)
  }, [interactive, disabled, loading])

  // Handle star click
  const handleStarClick = useCallback((starIndex: number) => {
    if (!interactive || disabled || loading) return
    
    const rating = allowHalf ? starIndex + 0.5 : starIndex + 1
    onRatingChange?.(rating)
  }, [interactive, disabled, loading, allowHalf, onRatingChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, starIndex: number) => {
    if (!interactive || disabled || loading) return
    
    const rating = starIndex + 1
    
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        onRatingChange?.(rating)
        onRatingSubmit?.(rating)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault()
        if (starIndex < maxStars - 1) {
          const nextRating = starIndex + 2
          onRatingChange?.(nextRating)
          // Focus next star
          const nextStar = event.currentTarget.nextElementSibling as HTMLElement
          nextStar?.focus()
        }
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault()
        if (starIndex > 0) {
          const prevRating = starIndex
          onRatingChange?.(prevRating)
          // Focus previous star
          const prevStar = event.currentTarget.previousElementSibling as HTMLElement
          prevStar?.focus()
        }
        break
      case 'Home':
        event.preventDefault()
        onRatingChange?.(1)
        // Focus first star
        const firstStar = event.currentTarget.parentElement?.firstElementChild as HTMLElement
        firstStar?.focus()
        break
      case 'End':
        event.preventDefault()
        onRatingChange?.(maxStars)
        // Focus last star
        const lastStar = event.currentTarget.parentElement?.lastElementChild as HTMLElement
        lastStar?.focus()
        break
    }
  }, [interactive, disabled, loading, maxStars, onRatingChange, onRatingSubmit])

  // Generate stars array
  const stars = useMemo(() => {
    return Array.from({ length: maxStars }, (_, index) => {
      const starValue = index + 1
      const isFilled = displayRating >= starValue
      const isHalfFilled = allowHalf && displayRating >= starValue - 0.5 && displayRating < starValue
      
      return {
        index,
        isFilled,
        isHalfFilled,
        value: starValue
      }
    })
  }, [maxStars, displayRating, allowHalf])

  // Get current rating label
  const currentLabel = useMemo(() => {
    if (loading) return 'Loading...'
    if (displayRating === 0) return 'No rating'
    
    const ratingIndex = Math.ceil(displayRating) - 1
    return labels[ratingIndex] || `${displayRating} stars`
  }, [displayRating, labels, loading])

  // Determine ARIA attributes
  const ariaProps = useMemo(() => {
    const baseProps = {
      'aria-label': ariaLabel || `Rating: ${displayRating} out of ${maxStars} stars`,
      'aria-valuemin': 0,
      'aria-valuemax': maxStars,
      'aria-valuenow': displayRating,
      'aria-valuetext': currentLabel
    }

    if (interactive && !disabled && !loading) {
      return {
        ...baseProps,
        role: 'slider',
        tabIndex: 0
      }
    }

    return {
      ...baseProps,
      role: 'img'
    }
  }, [ariaLabel, displayRating, maxStars, currentLabel, interactive, disabled, loading])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Stars Container */}
      <div
        className={cn(
          'flex items-center gap-1',
          interactive && !disabled && !loading && 'cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseLeave={handleMouseLeave}
        {...ariaProps}
      >
        {stars.map(({ index, isFilled, isHalfFilled }) => (
          <button
            key={index}
            type="button"
            className={cn(
              'relative transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded',
              interactive && !disabled && !loading && 'hover:scale-110',
              !interactive && 'cursor-default',
              disabled && 'cursor-not-allowed'
            )}
            disabled={disabled || loading || !interactive}
            onMouseEnter={() => handleMouseEnter(index)}
            onClick={() => handleStarClick(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={interactive && !disabled && !loading ? 0 : -1}
            aria-label={`${index + 1} star${index === 0 ? '' : 's'}`}
          >
            {/* Background Star */}
            <Star
              className={cn(
                sizeClasses[size],
                'text-gray-300 transition-colors duration-200'
              )}
            />
            
            {/* Filled Star */}
            <Star
              className={cn(
                sizeClasses[size],
                'absolute inset-0 text-yellow-400 transition-all duration-200',
                isFilled ? 'opacity-100' : 'opacity-0',
                isHalfFilled && 'opacity-50'
              )}
              fill="currentColor"
            />
            
            {/* Half Star Overlay */}
            {allowHalf && isHalfFilled && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <Star
                  className={cn(sizeClasses[size], 'text-yellow-400')}
                  fill="currentColor"
                />
              </div>
            )}
            
            {/* Loading State */}
            {loading && (
              <div className={cn(
                'absolute inset-0 animate-pulse bg-gray-200 rounded',
                sizeClasses[size]
              )} />
            )}
          </button>
        ))}
      </div>

      {/* Rating Value and Label */}
      {showValue && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900">
            {loading ? '...' : displayRating.toFixed(allowHalf ? 1 : 0)}
          </span>
          {interactive && isHovering && (
            <span className="text-gray-600">
              ({currentLabel})
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Export default for easier imports
export default StarRating 