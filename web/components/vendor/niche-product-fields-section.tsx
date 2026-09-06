'use client'

/**
 * L1 stub — platform store has no niche product fields.
 * L2 packs overwrite this file with vertical forms (e.g. agricultural).
 *
 * The signature mirrors the L2 pack contract (mvm-agricultural) so the L1
 * caller (`vendor/products/product-form.tsx`) type-checks against both.
 */
export default function NicheProductFieldsSection(_props: {
  /** Disables inputs when a submit is pending. */
  isPending?: boolean
  /** Initial field values from the product's `data` blob. */
  existingData?: unknown
  /** Currently selected product category — used to show category-specific fields. */
  category?: string
}) {
  return null
}
