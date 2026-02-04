'use client'

/**
 * Store Logo Uploader - Vercel Blob Integration
 * 
 * Single image uploader for vendor store logo with:
 * - Drag & drop support
 * - Click to browse
 * - Preview with remove option
 * - File validation (size, type)
 * - Mobile camera access
 * - Agricultural theme styling
 */

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface StoreLogoUploaderProps {
  onLogoChange: (file: File | null) => void
  initialUrl?: string | null
  error?: string
}

export default function StoreLogoUploader({ onLogoChange, initialUrl, error }: StoreLogoUploaderProps) {
  const t = useTranslations('vendor.onboarding.form')
  const [preview, setPreview] = useState<string | null>(initialUrl || null)
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const selectedFile = acceptedFiles[0]
    
    // Validation
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    // More robust MIME type and extension validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))

    // Check both MIME type and file extension for better reliability
    const isValidType = allowedTypes.includes(selectedFile.type)
    const isValidExtension = allowedExtensions.includes(fileExtension)

    if (!isValidType && !isValidExtension) {
      alert('Logo must be JPG, PNG, or WebP format')
      return
    }

    // Additional check: if MIME type is missing but extension is valid, accept it
    if (!isValidType && isValidExtension) {
      console.warn('File has valid extension but unknown MIME type, proceeding with upload')
    }

    // Set file and preview
    setFile(selectedFile)
    onLogoChange(selectedFile)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }, [onLogoChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
    multiple: false
  })

  const handleRemove = () => {
    setFile(null)
    setPreview(null)
    onLogoChange(null)
  }

  return (
    <div className="space-y-3">
      {!preview ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
            isDragActive 
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 scale-105" 
              : "border-border hover:border-emerald-500 hover:bg-muted/30",
            error && "border-destructive"
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-lime-500/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-emerald-600" />
            </div>
            
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? 'Drop logo here...' : t('uploadLogo')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('storeLogoHint')}
              </p>
            </div>

            <Button type="button" variant="outline" size="sm" className="mt-2">
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative aspect-square w-48 mx-auto rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-lg">
            <Image 
              src={preview} 
              alt="Store logo preview" 
              fill 
              className="object-cover"
            />
            
            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 backdrop-blur-sm text-white text-xs py-1.5 px-2 flex items-center justify-center gap-1">
              <ImageIcon className="w-3 h-3" />
              <span>Store Logo</span>
            </div>
          </div>

          {/* Change button */}
          <div className="text-center mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="text-xs"
            >
              {t('changeLogo')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}

