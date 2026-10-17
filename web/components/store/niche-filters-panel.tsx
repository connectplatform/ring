'use client'

/**
 * L1 stub — platform store filters have no vertical controls.
 * L2 packs overwrite this file.
 */
export default function NicheFiltersPanel(_props: {
  niche?: Record<string, string>
  products?: Array<{ nicheData?: Record<string, unknown> }>
  facets?: import('@/features/store/niche/niche-facets').NicheFacet[] | null
  onChange?: (niche: Record<string, string>) => void
}) {
  return null
}
