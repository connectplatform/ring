'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SafeImageProps {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  fallbackIcon?: React.ReactNode
  priority?: boolean
  sizes?: string
  fill?: boolean
  style?: React.CSSProperties
}

/**
 * SafeImage component that gracefully handles image loading errors
 * Falls back to a default icon when the image fails to load or src is invalid
 */
export function SafeImage({
  src,
  alt,
  width = 100,
  height = 100,
  className,
  fallbackIcon,
  priority = false,
  sizes,
  fill = false,
  style,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if src is a valid URL and not a placeholder
  const isValidSrc = src && 
    src.trim() !== '' && 
    !src.includes('example.com') && 
    !src.startsWith('http://example.com') &&
    !src.startsWith('https://example.com')

  // If no valid src or error occurred, show fallback
  if (!isValidSrc || hasError) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600",
          className
        )}
        style={fill ? { position: 'absolute', inset: 0 } : { width, height, ...style }}
      >
        {fallbackIcon || <Building2 className="w-6 h-6 text-gray-400" />}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} style={fill ? undefined : { width, height }}>
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
          style={fill ? undefined : { width, height }}
        >
          <Building2 className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        className={cn("rounded-lg", isLoading ? "opacity-0" : "opacity-100", className)}
        style={style}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        // Prevent Next.js from retrying failed images infinitely
        unoptimized={src.startsWith('http') && !src.includes(process.env.NEXT_PUBLIC_API_URL || '')}
      />
    </div>
  )
}

/**
 * EntityLogo component specifically for entity logos with appropriate fallback
 */
export function EntityLogo({
  src,
  entityName,
  size = 'md',
  className,
}: {
  src?: string | null
  entityName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeMap = {
    sm: { width: 48, height: 48, iconSize: 'w-4 h-4' },
    md: { width: 100, height: 100, iconSize: 'w-6 h-6' },
    lg: { width: 200, height: 200, iconSize: 'w-8 h-8' },
  }

  const { width, height, iconSize } = sizeMap[size]

  return (
    <SafeImage
      src={src}
      alt={`${entityName} logo`}
      width={width}
      height={height}
      className={cn("object-contain", className)}
      fallbackIcon={<Building2 className={cn(iconSize, "text-gray-400")} />}
    />
  )
}
