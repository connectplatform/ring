"use client"

import React, { useState, useRef } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Camera, Upload } from "lucide-react"

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
  fallback?: string
  className?: string
  onClick?: () => void
  editable?: boolean
  onUpload?: (file: File) => Promise<void>
  uploading?: boolean
}

/**
 * Avatar Component
 * Displays user profile picture with fallback to initials
 * Enhanced with upload functionality for profile images
 */
export function Avatar({
  src,
  alt = "",
  size = "md",
  fallback,
  className,
  onClick,
  editable = false,
  onUpload,
  uploading = false
}: AvatarProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-base",
    xl: "h-24 w-24 text-lg",
    "2xl": "h-32 w-32 text-xl"
  }

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
    "2xl": 128
  }

  const baseClasses = "relative flex items-center justify-center rounded-full bg-muted overflow-hidden group"
  const interactiveClasses = (onClick || editable) ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
  const dragClasses = dragOver ? "ring-2 ring-primary ring-offset-2" : ""

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) {
      onUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file && onUpload) {
      onUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleClick = () => {
    if (editable && !uploading) {
      fileInputRef.current?.click()
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div
      className={cn(baseClasses, sizeClasses[size], interactiveClasses, dragClasses, className)}
      onClick={handleClick}
      onDrop={editable ? handleDrop : undefined}
      onDragOver={editable ? handleDragOver : undefined}
      onDragLeave={editable ? handleDragLeave : undefined}
    >
      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      )}

      {/* Image or fallback */}
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

      {/* Upload overlay for editable avatars */}
      {editable && (
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Camera className="w-4 h-4 text-white" />
          )}
        </div>
      )}

      {/* Drag overlay */}
      {editable && dragOver && (
        <div className="absolute inset-0 bg-primary bg-opacity-20 rounded-full flex items-center justify-center">
          <Upload className="w-4 h-4 text-primary" />
        </div>
      )}
    </div>
  )
}

