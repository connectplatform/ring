'use client'

/**
 * SSOT GenerativeMediaField — Upload | Generate tabs inside the widget.
 * Used by NFT create and admin/vendor product forms.
 */

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GenerativeGalleryStrip } from '@/features/generative-media/components/generative-gallery-strip'
import { GenerativeMediaEditorFsModal } from '@/features/generative-media/components/generative-media-editor-fs-modal'
import {
  galleryFromUrlList,
  primaryGalleryUrl,
  toProductImageUrls,
  type GalleryItem,
  type GenerativeGalleryValue,
  type GenerativeMediaScope,
} from '@/features/generative-media/types'

export function GenerativeMediaField({
  name = 'imageUri',
  scope,
  pageSlug,
  fieldId,
  entityId,
  purpose,
  uploadPurpose,
  initialUrls,
  value: controlledValue,
  onChange,
  context,
  actionUrl,
  imagesFieldName,
  maxItems = 8,
}: {
  name?: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  purpose?: string
  uploadPurpose?: string
  initialUrls?: string[]
  value?: GenerativeGalleryValue
  onChange?: (next: GenerativeGalleryValue) => void
  context?: {
    name?: string
    category?: string
    description?: string
    vendorName?: string
  }
  actionUrl?: string
  /** When set, also posts JSON gallery + ordered image URL list for product forms */
  imagesFieldName?: string
  maxItems?: number
}) {
  const t = useTranslations('modules.generativeMedia')
  const [internal, setInternal] = useState<GenerativeGalleryValue>(() =>
    galleryFromUrlList(initialUrls || []),
  )
  const [editorOpen, setEditorOpen] = useState(false)

  const value = controlledValue ?? internal
  const setValue = (next: GenerativeGalleryValue) => {
    if (onChange) onChange(next)
    else setInternal(next)
  }

  const primary = value.items.find((i) => i.isPrimary) || value.items[0]
  const referenceUrl = primary?.originalUrl

  const imagesJson = useMemo(() => JSON.stringify(value), [value])
  const orderedUrls = useMemo(() => toProductImageUrls(value), [value])

  function addGenerated(item: GalleryItem) {
    const nextItems = value.items.map((i) => ({ ...i, isPrimary: false }))
    setValue({ items: [...nextItems, { ...item, isPrimary: true, enabled: true }] })
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">{t('uploadTab')}</TabsTrigger>
          <TabsTrigger value="generate">{t('generateTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <GenerativeGalleryStrip
            scope={scope}
            pageSlug={pageSlug}
            fieldId={fieldId}
            entityId={entityId}
            value={value}
            onChange={setValue}
            maxItems={maxItems}
            uploadPurpose={uploadPurpose || (scope === 'product' ? 'vendor:product-media' : 'nft:media')}
          />
        </TabsContent>

        <TabsContent value="generate" className="mt-3 space-y-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{t('generateHint')}</p>
            <Button
              type="button"
              className="mt-3"
              variant="secondary"
              onClick={() => setEditorOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('openEditor')}
            </Button>
          </div>

          {primary ? (
            <div className="overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primary.webpUrl || primary.originalUrl}
                alt={t('primaryAlt')}
                className="aspect-square w-full max-w-sm object-cover"
              />
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('primaryHint')}</p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <input type="hidden" name={name} value={primaryGalleryUrl(value)} />
      <input type="hidden" name={`${name}Gallery`} value={imagesJson} />
      {imagesFieldName ? (
        <>
          <input type="hidden" name={imagesFieldName} value={orderedUrls.join(',')} />
          <input type="hidden" name={`${imagesFieldName}Gallery`} value={imagesJson} />
        </>
      ) : null}

      <GenerativeMediaEditorFsModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        scope={scope}
        pageSlug={pageSlug}
        fieldId={fieldId}
        entityId={entityId}
        purpose={purpose}
        actionUrl={actionUrl}
        context={context}
        referenceImageUrl={referenceUrl}
        onUseImage={addGenerated}
      />
    </div>
  )
}
