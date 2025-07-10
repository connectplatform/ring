'use client'

import React, { useState, useCallback } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Camera, X, AlertCircle } from 'lucide-react'
import { StarRating } from '@/components/ui/star-rating'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export interface ReviewFormProps {
  /** The entity or opportunity being reviewed */
  targetId: string
  /** Type of target (entity, opportunity, user) */
  targetType: 'entity' | 'opportunity' | 'user'
  /** Existing review data for editing */
  existingReview?: {
    id: string
    rating: number
    title: string
    content: string
    photos?: string[]
  }
  /** Callback when review is submitted successfully */
  onSuccess?: (reviewId: string) => void
  /** Callback when form is cancelled */
  onCancel?: () => void
  /** Custom class name */
  className?: string
}

interface ReviewFormState {
  success: boolean
  error?: string
  reviewId?: string
}

const initialState: ReviewFormState = {
  success: false
}

// Server Action for submitting reviews (placeholder)
async function submitReviewAction(formData: FormData): Promise<ReviewFormState> {
  // This would be implemented as a proper server action
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Return success response
    return {
      success: true,
      reviewId: `review_${Date.now()}`
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to submit review'
    }
  }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full"
    >
      {pending ? 'Submitting Review...' : 'Submit Review'}
    </Button>
  )
}

function CancelButton({ onCancel }: { onCancel?: () => void }) {
  const { pending } = useFormStatus()
  
  return (
    <Button 
      type="button" 
      variant="outline" 
      onClick={onCancel}
      disabled={pending}
      className="w-full"
    >
      Cancel
    </Button>
  )
}

export function ReviewForm({
  targetId,
  targetType,
  existingReview,
  onSuccess,
  onCancel,
  className
}: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>(existingReview?.photos || [])
  const [dragOver, setDragOver] = useState(false)

  // React 19 useActionState for form handling
  const [state, formAction] = useActionState(
    async (prevState: ReviewFormState, formData: FormData) => {
      try {
        // Add rating and target info to form data
        formData.append('rating', rating.toString())
        formData.append('targetId', targetId)
        formData.append('targetType', targetType)
        
        // Add existing review ID if editing
        if (existingReview?.id) {
          formData.append('reviewId', existingReview.id)
        }

        // Add uploaded photos
        uploadedPhotos.forEach((photo, index) => {
          formData.append(`photo-${index}`, photo)
        })

        const result = await submitReviewAction(formData)
        
        if (result.success) {
          onSuccess?.(result.reviewId!)
          return {
            success: true,
            reviewId: result.reviewId
          }
        } else {
          return {
            success: false,
            error: result.error || 'Failed to submit review'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred'
        }
      }
    },
    initialState
  )

  // Handle photo upload
  const handlePhotoUpload = useCallback((files: FileList | null) => {
    if (!files) return

    const validFiles = Array.from(files).filter(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return false
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return false
      }
      
      return true
    })

    // Limit to 5 photos total
    const remainingSlots = 5 - uploadedPhotos.length - photoUrls.length
    const filesToAdd = validFiles.slice(0, remainingSlots)
    
    setUploadedPhotos(prev => [...prev, ...filesToAdd])
  }, [uploadedPhotos.length, photoUrls.length])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handlePhotoUpload(e.dataTransfer.files)
  }, [handlePhotoUpload])

  // Remove uploaded photo
  const removeUploadedPhoto = useCallback((index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Remove existing photo URL
  const removePhotoUrl = useCallback((index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <Card className={cn('w-full max-w-2xl mx-auto', className)}>
      <CardHeader>
        <CardTitle>
          {existingReview ? 'Edit Review' : 'Write a Review'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* Error Display */}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {state.success && (
            <Alert>
              <AlertDescription>
                Review submitted successfully! Thank you for your feedback.
              </AlertDescription>
            </Alert>
          )}

          {/* Rating Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Overall Rating *
            </Label>
            <StarRating
              value={rating}
              interactive
              size="lg"
              showValue
              onRatingChange={setRating}
              className="justify-start"
              ariaLabel="Select your overall rating"
            />
            {rating === 0 && (
              <p className="text-sm text-red-600">
                Please select a rating
              </p>
            )}
          </div>

          {/* Review Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium">
              Review Title *
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="Summarize your experience..."
              defaultValue={existingReview?.title}
              required
              maxLength={100}
              className="w-full"
            />
          </div>

          {/* Review Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-base font-medium">
              Your Review *
            </Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Share your detailed experience..."
              defaultValue={existingReview?.content}
              required
              minLength={10}
              maxLength={1000}
              rows={6}
              className="w-full resize-none"
            />
            <p className="text-sm text-gray-600">
              Minimum 10 characters, maximum 1000 characters
            </p>
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-4">
            <Label className="text-base font-medium">
              Add Photos (Optional)
            </Label>
            
            {/* Existing Photos */}
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {photoUrls.map((url, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`Review photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoUrl(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Uploaded Photos Preview */}
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {uploadedPhotos.map((file, index) => (
                  <div key={`upload-${index}`} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeUploadedPhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            {(uploadedPhotos.length + photoUrls.length) < 5 && (
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
                  'hover:border-gray-400'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    <label htmlFor="photo-upload" className="cursor-pointer text-blue-600 hover:text-blue-500">
                      Click to upload
                    </label>
                    {' or drag and drop'}
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG up to 5MB (max 5 photos)
                  </p>
                </div>
                <input
                  id="photo-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <SubmitButton />
            {onCancel && <CancelButton onCancel={onCancel} />}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default ReviewForm 