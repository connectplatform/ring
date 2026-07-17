'use client'

/**
 * @deprecated Prefer GenerativeMediaField from `@/features/generative-media`.
 * Thin NFT-scoped wrapper for legacy imports.
 */

import { GenerativeMediaField } from '@/features/generative-media/components/generative-media-field'

export function NftMediaField({
  name = 'imageUri',
  fieldId,
  pageSlug = 'nft-create',
  purpose,
}: {
  name?: string
  fieldId: string
  pageSlug?: string
  purpose?: string
  labelUpload?: string
}) {
  return (
    <GenerativeMediaField
      name={name}
      scope="nft"
      fieldId={fieldId}
      pageSlug={pageSlug}
      purpose={purpose}
      actionUrl="/nft/create"
    />
  )
}
