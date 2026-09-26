'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useOptionalStore } from '@/features/store/context'
import type { Locale } from '@/i18n/shared'

export function LocalFavoritesIsland({ locale }: { locale: Locale }) {
  const [favoriteIds] = useLocalStorage<string[]>('ring_favorites', [])
  const store = useOptionalStore()
  const t = useTranslations('modules.store.favorites')
  const tOpp = useTranslations('modules.opportunities')

  const resolved = favoriteIds
    .map((id) => {
      const enhanced = store?.enhancedProducts || []
      const legacy = store?.products || []
      return [...enhanced, ...legacy].find((product) => product.id === id)
    })
    .filter(Boolean) as Array<{ id: string; name: string }>

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{tOpp('favoritesLocalStore')}</h2>
      {resolved.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {resolved.map((product) => (
            <li key={product.id}>
              <Link
                href={ROUTES.STORE_PRODUCT(product.id, locale)}
                className="text-sm font-medium hover:underline"
              >
                {product.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
