'use client'

/**
 * Approval Status Badge Component
 * 
 * Displays Main Store approval status for vendor products with:
 * - Color-coded badges (amber/emerald/red)
 * - Icons and clear text
 * - Tooltips for additional context
 * 
 * Status Flow:
 * 1. pending: ⏳ Awaiting Admin Review (amber)
 * 2. approved: ✓ Listed in Main Store (emerald)
 * 3. rejected: ❌ Not Approved (red with reason)
 */

import React from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | null

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus
  rejectionReason?: string
  className?: string
}

export default function ApprovalStatusBadge({ 
  status, 
  rejectionReason, 
  className 
}: ApprovalStatusBadgeProps) {
  const t = useTranslations('vendor.products.mainStore')

  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        {t('notSubmitted')}
      </Badge>
    )
  }

  switch (status) {
    case 'pending':
      return (
        <Badge 
          className={cn(
            "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
            "hover:bg-amber-500/20",
            className
          )}
        >
          <Clock className="w-3 h-3 mr-1" />
          {t('pending')}
        </Badge>
      )
    
    case 'approved':
      return (
        <Badge 
          className={cn(
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
            "hover:bg-emerald-500/20",
            className
          )}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t('approved')}
        </Badge>
      )
    
    case 'rejected':
      return (
        <Badge 
          className={cn(
            "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
            "hover:bg-red-500/20",
            className
          )}
        >
          <XCircle className="w-3 h-3 mr-1" />
          {t('rejected')}
        </Badge>
      )
    
    default:
      return null
  }
}

