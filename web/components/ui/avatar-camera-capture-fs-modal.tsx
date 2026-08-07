'use client'

/**
 * Live webcam capture via getUserMedia → File for avatar crop/upload.
 * Replaces HTML capture="user" which falls back to browse on desktop.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, SwitchCamera, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FsModal } from '@/components/ui/fs-modal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export type AvatarCameraCaptureFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
  title?: string
}

export function AvatarCameraCaptureFsModal({
  open,
  onOpenChange,
  onCapture,
  title = 'Take photo',
}: AvatarCameraCaptureFsModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [capturing, setCapturing] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setReady(false)
  }, [])

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setError(null)
    setReady(false)
    stopStream()

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser. Use Upload instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setReady(true)
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Camera permission denied. Allow camera access or use Upload.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera found on this device. Use Upload instead.')
      } else {
        setError(e instanceof Error ? e.message : 'Could not start camera')
      }
    }
  }, [stopStream])

  useEffect(() => {
    if (!open) {
      stopStream()
      setError(null)
      setCapturing(false)
      return
    }
    void startCamera(facingMode)
    return () => {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on open / facing flip
  }, [open, facingMode])

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !ready || video.videoWidth <= 0) return
    setCapturing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('Could not capture frame')
        setCapturing(false)
        return
      }
      // Mirror selfie when using front camera so crop matches preview
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          setCapturing(false)
          if (!blob) {
            setError('Could not encode photo')
            return
          }
          const file = new File([blob], `avatar-camera-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          })
          stopStream()
          onCapture(file)
          onOpenChange(false)
        },
        'image/jpeg',
        0.92,
      )
    } catch (e) {
      setCapturing(false)
      setError(e instanceof Error ? e.message : 'Capture failed')
    }
  }

  return (
    <FsModal
      open={open}
      onOpenChange={(next) => {
        if (!next) stopStream()
        onOpenChange(next)
      }}
      title={title}
      description="Position your face in the frame, then capture."
      className="sm:max-w-xl"
      contentClassName="!px-0 !py-0"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={flipCamera}
            disabled={!ready || Boolean(error)}
            className="gap-1.5"
          >
            <SwitchCamera className="h-4 w-4" />
            Flip
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={capture}
              disabled={!ready || capturing || Boolean(error)}
              className="gap-1.5"
            >
              <Camera className="h-4 w-4" />
              {capturing ? 'Capturing…' : 'Capture'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Alert variant="destructive" className="max-w-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn(
            'h-full w-full object-cover',
            facingMode === 'user' && 'scale-x-[-1]',
            (!ready || error) && 'opacity-0',
          )}
        />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Starting camera…
          </div>
        ) : null}
        {/* Soft oval guide */}
        {ready && !error ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="h-[70%] aspect-square rounded-full border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}
      </div>
    </FsModal>
  )
}
