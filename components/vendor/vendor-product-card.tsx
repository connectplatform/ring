'use client'

/**
 * Vendor Product Card Component
 * 
 * Individual product card displayed in vendor products grid.
 * 
 * Features:
 * - Product photo with hover zoom
 * - Product name, price, stock
 * - Approval status badge (Main Store)
 * - Active/Inactive toggle
 * - Action buttons (Edit, Duplicate, Delete, Preview)
 * - Agricultural theme
 * 
 * Tech: React 19 + Framer Motion + Optimistic Updates
 */

import React, { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import { 
  Edit, 
  Copy, 
  Trash2, 
  Eye, 
  ExternalLink, 
  MoreVertical,
  Power,
  PowerOff
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ApprovalStatusBadge, { type ApprovalStatus } from './approval-status-badge'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { toggleProductActive, deleteVendorProduct, duplicateVendorProduct } from '@/app/_actions/vendor-actions'
import type { Locale } from '@/i18n-config'

interface VendorProductCardProps {
  product: {
    id: string
    name: string
    images: string[]
    price: number
    currency: string
    stock_quantity: number
    status: string
    category: string
    data?: {
      approvalStatus?: ApprovalStatus
      rejectionReason?: string
      activeInVendorStore?: boolean
      vendorId?: string
    }
  }
  onProductUpdated?: () => void
}

export default function VendorProductCard({ product, onProductUpdated }: VendorProductCardProps) {
  const t = useTranslations('vendor.products')
  const tActions = useTranslations('vendor.products.actions')
  const locale = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(product.status === 'active')

  const mainImage = product.images?.[0] || '/placeholder-product.jpg'
  const approvalStatus = product.data?.approvalStatus || null
  const isApproved = approvalStatus === 'approved'
  const vendorId = product.data?.vendorId

  const handleToggleActive = async () => {
    const previousState = isActive
    setIsActive(!previousState) // Optimistic update

    startTransition(async () => {
      const result = await toggleProductActive(product.id)
      
      if (result.error) {
        setIsActive(previousState) // Revert on error
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: `Product ${result.newStatus === 'active' ? 'activated' : 'deactivated'}`
        })
        onProductUpdated?.()
      }
    })
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm.message', { name: product.name }))) {
      return
    }

    startTransition(async () => {
      const result = await deleteVendorProduct(product.id, locale)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: t('notifications.productDeleted')
        })
        onProductUpdated?.()
      }
    })
  }

  const handleDuplicate = async () => {
    startTransition(async () => {
      const result = await duplicateVendorProduct(product.id, locale)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Success",
          description: "Product duplicated successfully"
        })
        onProductUpdated?.()
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "overflow-hidden hover:shadow-xl transition-all duration-300",
        "border-emerald-500/20",
        !isActive && "opacity-60"
      )}>
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image 
            src={mainImage} 
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {/* Status overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <Badge 
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "text-xs",
                isActive 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-gray-500 hover:bg-gray-600"
              )}
            >
              {isActive ? t('status.active') : t('status.inactive')}
            </Badge>
          </div>

          {/* Actions dropdown */}
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 bg-white/90 hover:bg-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.VENDOR_PRODUCTS_EDIT(locale, product.id)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {tActions('edit')}
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
                  <Copy className="h-4 w-4 mr-2" />
                  {tActions('duplicate')}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handleToggleActive} disabled={isPending}>
                  {isActive ? (
                    <><PowerOff className="h-4 w-4 mr-2" />{tActions('deactivate')}</>
                  ) : (
                    <><Power className="h-4 w-4 mr-2" />{tActions('activate')}</>
                  )}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {vendorId && (
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.VENDOR_STOREFRONT(locale, vendorId)} target="_blank">
                      <Eye className="h-4 w-4 mr-2" />
                      {tActions('viewInStore')}
                    </Link>
                  </DropdownMenuItem>
                )}
                
                {isApproved && (
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/store/${product.id}`} target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {tActions('viewInMainStore')}
                    </Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={handleDelete} 
                  disabled={isPending}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tActions('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Approval status badge */}
          {approvalStatus && (
            <div className="absolute bottom-2 left-2 right-2">
              <ApprovalStatusBadge 
                status={approvalStatus} 
                rejectionReason={product.data?.rejectionReason}
              />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                {product.price.toFixed(2)} {product.currency}
              </p>
              <p className="text-xs text-muted-foreground">
                Stock: {product.stock_quantity}
              </p>
            </div>
            
            <Link href={ROUTES.VENDOR_PRODUCTS_EDIT(locale, product.id)}>
              <Button size="sm" variant="outline" className="h-8">
                <Edit className="h-3 w-3 mr-1" />
                {tActions('edit')}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

