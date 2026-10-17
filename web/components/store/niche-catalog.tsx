'use client'

import type { ReactNode } from 'react'
import { ProductCard } from '@/features/store/components/product-card'
import type { StoreProduct } from '@/features/store/types'
import type { Locale } from '@/i18n/shared'

/** Grid class for the inventory column. Packs overwrite the whole module. */
export const NICHE_CATALOG_GRID_CLASS =
  'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'

/** Packs overwrite this to add a lists tab around the catalog grid. */
export function NicheCatalogView({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Packs overwrite this to render a vertical card. Others stay on ProductCard. */
export function NicheProductCard({
  product,
  locale,
}: {
  product: StoreProduct
  locale: Locale
}) {
  return <ProductCard product={product} locale={locale} />
}
