'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  listAdminStoreProducts,
  updateAdminProductApproval,
  delistAdminStoreProduct,
  type AdminStoreProductRow,
} from '@/app/_actions/admin-store-erp'
import { ADMIN_LIST_PAGE_SIZE } from '@/lib/admin/admin-list-dto'

interface AdminProductsClientProps {
  products: AdminStoreProductRow[]
  initialHasMore: boolean
  initialNextOffset: number
  initialApprovalFilter: 'all' | 'pending' | 'approved' | 'rejected'
  locale: Locale
}

export default function AdminProductsClient({
  products: initialProducts,
  initialHasMore,
  initialNextOffset,
  initialApprovalFilter,
  locale,
}: AdminProductsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('modules.admin.storeHub.productsPage')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState(initialProducts)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)

  useEffect(() => {
    setProducts(initialProducts)
    setHasMore(initialHasMore)
    setNextOffset(initialNextOffset)
  }, [initialProducts, initialHasMore, initialNextOffset])

  const handleFilterChange = (value: typeof initialApprovalFilter) => {
    const params = new URLSearchParams(searchParams)
    if (value === 'all') {
      params.delete('approval')
    } else {
      params.set('approval', value)
    }
    startTransition(() => {
      router.push(`${ROUTES.ADMIN_STORE_PRODUCTS(locale)}?${params.toString()}`)
    })
  }

  const handleLoadMore = () => {
    startTransition(async () => {
      setError(null)
      try {
        const page = await listAdminStoreProducts({
          limit: ADMIN_LIST_PAGE_SIZE,
          offset: nextOffset,
          approvalStatus: initialApprovalFilter,
        })
        setProducts((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))]
        })
        setHasMore(page.hasMore)
        setNextOffset(page.nextOffset)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('approvalError'))
      }
    })
  }

  const handleDelist = (productId: string) => {
    if (!window.confirm(t('delistConfirm'))) return
    startTransition(async () => {
      setError(null)
      try {
        const formData = new FormData()
        formData.set('productId', productId)
        await delistAdminStoreProduct(formData)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('delistError'))
      }
    })
  }

  const handleApproval = (productId: string, approvalStatus: 'approved' | 'rejected') => {
    const rejectionReason =
      approvalStatus === 'rejected'
        ? window.prompt(t('rejectPrompt'))?.trim()
        : undefined
    if (approvalStatus === 'rejected' && !rejectionReason) return

    startTransition(async () => {
      setError(null)
      try {
        const formData = new FormData()
        formData.set('productId', productId)
        formData.set('approvalStatus', approvalStatus)
        if (rejectionReason) formData.set('rejectionReason', rejectionReason)
        await updateAdminProductApproval(formData)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('approvalError'))
      }
    })
  }

  const approvalBadge = (status?: string | null) => {
    if (!status) return <Badge variant="outline">{t('approval.none')}</Badge>
    if (status === 'pending') return <Badge variant="secondary">{t('approval.pending')}</Badge>
    if (status === 'approved') return <Badge>{t('approval.approved')}</Badge>
    if (status === 'rejected') return <Badge variant="destructive">{t('approval.rejected')}</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={ROUTES.ADMIN_STORE_PRODUCTS_ADD(locale)}>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {t('addProduct')}
            </Button>
          </Link>
          <Select
            value={initialApprovalFilter}
            onValueChange={(value) => handleFilterChange(value as typeof initialApprovalFilter)}
            disabled={isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.all')}</SelectItem>
              <SelectItem value="pending">{t('filters.pending')}</SelectItem>
              <SelectItem value="approved">{t('filters.approved')}</SelectItem>
              <SelectItem value="rejected">{t('filters.rejected')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{t('columns.name')}</th>
                  <th className="py-2 pr-4">{t('columns.vendor')}</th>
                  <th className="py-2 pr-4">{t('columns.price')}</th>
                  <th className="py-2 pr-4">{t('columns.stock')}</th>
                  <th className="py-2 pr-4">{t('columns.status')}</th>
                  <th className="py-2 pr-4">{t('columns.approval')}</th>
                  <th className="py-2">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{product.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{product.vendorEntityId}</td>
                    <td className="py-2 pr-4">
                      {product.price} {product.currency}
                    </td>
                    <td className="py-2 pr-4">{product.stock}</td>
                    <td className="py-2 pr-4">{product.status ?? '—'}</td>
                    <td className="py-2 pr-4">{approvalBadge(product.approvalStatus)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={ROUTES.ADMIN_STORE_PRODUCTS_EDIT(product.id, locale)}>
                            {t('edit')}
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleDelist(product.id)}
                        >
                          {t('delist')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending || product.approvalStatus === 'approved'}
                          onClick={() => handleApproval(product.id, 'approved')}
                        >
                          {t('approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending || product.approvalStatus === 'rejected'}
                          onClick={() => handleApproval(product.id, 'rejected')}
                        >
                          {t('reject')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hasMore && (
            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isPending}
              >
                {t('showMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
