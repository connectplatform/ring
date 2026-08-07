import { randomUUID } from 'crypto'
import { ImageResponse } from 'next/og'
import { file } from '@/lib/file'
import { getStoragePrefix } from '@/lib/images/image.config'
import type { ThumbnailSpec } from '@/lib/media/schemas'

export interface RenderThumbnailInput {
  backgroundUrl: string
  thumbnail: ThumbnailSpec
  purpose?: string
}

export interface RenderThumbnailResult {
  url: string
  fileId?: string
  size: number
  recordId: string
  contentType: string
}

function dimensionsForAspectRatio(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 720, height: 1280 }
    case '1:1':
      return { width: 1080, height: 1080 }
    case '16:9':
    default:
      return { width: 1280, height: 720 }
  }
}

function overlayStyle(
  position: string | undefined,
  role: string | undefined,
): Record<string, number | string> {
  const isTitle = role === 'title' || role === 'cta'
  const base: Record<string, number | string> = { fontSize: isTitle ? 56 : 36 }
  switch (position) {
    case 'top':
    case 'top-left':
      return { ...base, top: 48, left: 48 }
    case 'center':
      return { ...base, top: '42%', left: 48, right: 48 }
    case 'bottom-left':
      return { ...base, bottom: 48, left: 48 }
    case 'bottom-right':
      return { ...base, bottom: 48, right: 48 }
    case 'bottom':
    default:
      return { ...base, bottom: 48, left: 48, right: 48 }
  }
}

function buildThumbnailElement(
  backgroundUrl: string,
  thumbnail: ThumbnailSpec,
  width: number,
  height: number,
) {
  const template = thumbnail.template ?? 'default'
  const overlays = thumbnail.overlays ?? []
  const showGradient = template !== 'title_card'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <img
        src={backgroundUrl}
        alt=""
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {showGradient ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
          }}
        />
      )}
      {overlays.map((overlay, index) => {
        const pos = overlayStyle(overlay.position, overlay.role)
        return (
          <div
            key={`${overlay.text}-${index}`}
            style={{
              position: 'absolute',
              display: 'flex',
              color: 'white',
              fontWeight: overlay.role === 'title' || overlay.role === 'cta' ? 700 : 500,
              fontSize: pos.fontSize,
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              maxWidth: width - 96,
              ...pos,
            }}
          >
            {overlay.text}
          </div>
        )
      })}
    </div>
  )
}

export async function renderAndUploadThumbnail(
  input: RenderThumbnailInput,
): Promise<RenderThumbnailResult> {
  const aspectRatio = input.thumbnail.aspectRatio ?? '16:9'
  const { width, height } = dimensionsForAspectRatio(aspectRatio)

  const response = new ImageResponse(
    buildThumbnailElement(input.backgroundUrl, input.thumbnail, width, height),
    { width, height },
  )

  const buffer = Buffer.from(await response.arrayBuffer())
  const prefix = getStoragePrefix()
  const category = input.purpose?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'thumbnail'
  const objectKey = `${prefix}/${category}/thumbnails/${Date.now()}-${randomUUID().slice(0, 8)}.png`

  const upload = await file().upload(objectKey, buffer, {
    access: 'public',
    contentType: 'image/png',
    metadata: {
      source: 'scripted-media-thumbnail',
      template: input.thumbnail.template ?? 'default',
      ...(input.purpose ? { purpose: input.purpose } : {}),
    },
  })

  if (!upload.success || !upload.url) {
    throw new Error(upload.error || 'Failed to upload thumbnail')
  }

  return {
    url: upload.url,
    fileId: upload.fileId,
    size: upload.size ?? buffer.length,
    recordId: randomUUID(),
    contentType: 'image/png',
  }
}
