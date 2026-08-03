import type { ProductResearchMediaRef } from '@/features/store/lib/product-cabinet-media'
import type { WebProductFieldSuggestions } from '@/lib/web'

function parseObject(raw: FormDataEntryValue | null): Record<string, unknown> | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function parseMedia(raw: FormDataEntryValue | null): ProductResearchMediaRef[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item): item is ProductResearchMediaRef =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof (item as ProductResearchMediaRef).cabinetNodeId === 'string' &&
              typeof (item as ProductResearchMediaRef).storageUrl === 'string',
          ),
      )
      .slice(0, 40)
  } catch {
    return []
  }
}

export function parseProductResearchFormData(formData: FormData): {
  productAgent?: string
  nodusDraft?: Record<string, unknown>
  researchFields?: WebProductFieldSuggestions
  researchMedia: ProductResearchMediaRef[]
} {
  const productAgent = String(formData.get('productAgent') ?? '').trim() || undefined
  return {
    productAgent,
    nodusDraft: parseObject(formData.get('productNodusDraft')),
    researchFields: parseObject(
      formData.get('productResearchFields'),
    ) as unknown as WebProductFieldSuggestions | undefined,
    researchMedia: parseMedia(formData.get('productResearchMedia')),
  }
}
