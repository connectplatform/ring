'use client'

import Link from 'next/link'
import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, ImageIcon, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  quickUpdateAdminStoreProduct,
  type AdminStoreProductRow,
} from '@/app/_actions/admin-store-erp'
import { ADMIN_LIST_PAGE_SIZE } from '@/lib/admin/admin-list-dto'
import { STORE_PRODUCT_CATEGORIES } from '@/lib/zod/store-product'
import { ProductCategoryDroplist } from '@/components/store/product-category-droplist'
import { davinciGlassSurface } from '@/lib/ui/davinci'

type QuickDraft = {
  name: string
  price: string
  category: string
  description: string
}

interface AdminProductsClientProps {
  products: AdminStoreProductRow[]
  initialHasMore: boolean
  initialNextOffset: number
  initialApprovalFilter: 'all' | 'pending' | 'approved' | 'rejected'
  initialQuery: string
  initialTotal: number
  locale: Locale
}

export default function AdminProductsClient({
  products: initialProducts,
  initialHasMore,
  initialNextOffset,
  initialApprovalFilter,
  initialQuery,
  initialTotal,
  locale,
}: AdminProductsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('modules.admin.storeHub.productsPage')
  const tForm = useTranslations('vendor.products.form')
  const tCat = useTranslations('vendor.onboarding.categories')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState(initialProducts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuickDraft | null>(null)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [quickFilter, setQuickFilter] = useState(initialQuery)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const committed = initialQuery.trim()
      const next = quickFilter.trim()
      if (next === committed) return
      const params = new URLSearchParams(searchParams)
      if (next) params.set('q', next)
      else params.delete('q')
      startTransition(() => {
        router.push(`${ROUTES.ADMIN_STORE_PRODUCTS(locale)}?${params.toString()}`)
      })
    }, 300)
    return () => window.clearTimeout(handle)
  }, [quickFilter, initialQuery, locale, router, searchParams])

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
          q: initialQuery,
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

  const categoryLabel = (slug?: string) => {
    if (!slug) return '—'
    return tCat.has(slug) ? tCat(slug) : slug
  }

  const openQuickEdit = (product: AdminStoreProductRow) => {
    if (expandedId === product.id) {
      setExpandedId(null)
      setDraft(null)
      return
    }
    setExpandedId(product.id)
    setDraft({
      name: product.name,
      price: product.price,
      category: product.category || '',
      description: product.description || '',
    })
  }

  const handleQuickSave = (productId: string) => {
    if (!draft) return
    startTransition(async () => {
      setError(null)
      const result = await quickUpdateAdminStoreProduct({
        productId,
        name: draft.name,
        price: draft.price,
        category: draft.category,
        description: draft.description,
      })
      if (!result.success || !result.product) {
        setError(result.error || t('quickEditError'))
        return
      }
      setProducts((prev) => prev.map((row) => (row.id === productId ? result.product! : row)))
      setExpandedId(null)
      setDraft(null)
      router.refresh()
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
        setProducts((prev) =>
          prev.map((row) =>
            row.id === productId
              ? { ...row, status: 'inactive', mainStoreStatus: 'inactive' }
              : row,
          ),
        )
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
        setProducts((prev) =>
          prev.map((row) =>
            row.id === productId ? { ...row, approvalStatus } : row,
          ),
        )
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t('tableTitle')}</CardTitle>
          <div className="flex items-center gap-2 min-w-0">
            {initialQuery && (
              <span className="hidden sm:inline shrink-0 text-xs text-muted-foreground">
                {t('showingOf', { filtered: products.length, total: initialTotal })}
              </span>
            )}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                placeholder={t('quickFilter')}
                className="pl-8 pr-8 h-8"
              />
              {quickFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setQuickFilter('')}
                  aria-label={t('quickFilterClear')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {initialQuery ? t('quickFilterEmpty') : t('empty')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 w-14">{t('columns.photo')}</th>
                  <th className="py-2 pr-4">{t('columns.name')}</th>
                  <th className="py-2 pr-4">{t('columns.category')}</th>
                  <th className="py-2 pr-4">{t('columns.vendor')}</th>
                  <th className="py-2 pr-4">{t('columns.price')}</th>
                  <th className="py-2 pr-4">{t('columns.stock')}</th>
                  <th className="py-2 pr-4">{t('columns.status')}</th>
                  <th className="py-2 pr-4">{t('columns.approval')}</th>
                  <th className="py-2">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const expanded = expandedId === product.id && draft
                  const delisted = product.status === 'inactive' || product.mainStoreStatus === 'inactive'
                  return (
                    <Fragment key={product.id}>
                      <tr
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                        onClick={() => openQuickEdit(product)}
                      >
                        <td className="py-2 pr-3">
                          {product.thumbnailUrl ? (
                            // Catalog URLs come from storage hosts that are not all in next/image remotePatterns.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.thumbnailUrl}
                              alt=""
                              className="h-10 w-10 rounded-md object-cover bg-muted"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            {product.name}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{categoryLabel(product.category)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{product.vendorEntityId}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {product.price} {product.currency}
                        </td>
                        <td className="py-2 pr-4">{product.stock}</td>
                        <td className="py-2 pr-4">{delisted ? t('delisted') : (product.status ?? '—')}</td>
                        <td className="py-2 pr-4">{approvalBadge(product.approvalStatus)}</td>
                        <td className="py-2" onClick={(event) => event.stopPropagation()}>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openQuickEdit(product)}>
                              {t('quickEdit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending || delisted}
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
                      {expanded ? (
                        <tr key={`${product.id}-edit`} className="border-b border-border/50">
                          <td colSpan={9} className="py-3">
                            <div className={`space-y-4 p-4 ${davinciGlassSurface}`}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`quick-name-${product.id}`}>{tForm('name')}</Label>
                                  <Input
                                    id={`quick-name-${product.id}`}
                                    value={draft.name}
                                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                                    disabled={isPending}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`quick-price-${product.id}`}>{t('columns.price')}</Label>
                                  <Input
                                    id={`quick-price-${product.id}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.price}
                                    onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                                    disabled={isPending}
                                  />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                  <Label>{tForm('category')}</Label>
                                  <ProductCategoryDroplist
                                    value={draft.category}
                                    onChange={(category) => setDraft({ ...draft, category })}
                                    categories={STORE_PRODUCT_CATEGORIES}
                                    labelFor={(slug) => categoryLabel(slug)}
                                    scopeLabel={tForm('category')}
                                    placeholder={tForm('categoryPlaceholder')}
                                    disabled={isPending}
                                  />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                  <Label htmlFor={`quick-description-${product.id}`}>{tForm('description')}</Label>
                                  <Textarea
                                    id={`quick-description-${product.id}`}
                                    value={draft.description}
                                    maxLength={5000}
                                    rows={4}
                                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                                    disabled={isPending}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" disabled={isPending} onClick={() => handleQuickSave(product.id)}>
                                  {t('quickEditSave')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => {
                                    setExpandedId(null)
                                    setDraft(null)
                                  }}
                                >
                                  {t('quickEditCancel')}
                                </Button>
                              </div>
                              <Button className="w-full" variant="secondary" asChild>
                                <Link href={ROUTES.ADMIN_STORE_PRODUCTS_EDIT(product.id, locale)}>
                                  {t('editProduct')}
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
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
