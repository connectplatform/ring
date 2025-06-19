"use client"

import React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: "sm" | "md" | "lg" | "xl"
  fallback?: string
  className?: string
  onClick?: () => void
}

/**
 * Avatar Component
 * Displays user profile picture with fallback to initials
 */
export function Avatar({
  src,
  alt = "",
  size = "md",
  fallback,
  className,
  onClick
}: AvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-base",
    xl: "h-24 w-24 text-lg"
  }

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96
  }

  const baseClasses = "relative flex items-center justify-center rounded-full bg-muted overflow-hidden"
  const interactiveClasses = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""

  return (
    <div
      className={cn(baseClasses, sizeClasses[size], interactiveClasses, className)}
      onClick={onClick}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={sizePixels[size]}
          height={sizePixels[size]}
          className="h-full w-full object-cover rounded-full"
          onError={(e) => {
            // Hide broken images
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
          unoptimized={!src.startsWith('/')} // Don't optimize external images
        />
      ) : (
        <span className="font-medium text-muted-foreground">
          {fallback || alt.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

