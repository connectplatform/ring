'use client'

/**
 * VENDOR PRODUCTS RAIL - Extracted right-rail content
 * Quick Actions, Product Success Tips, and Product Guide.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Leaf, BookOpen, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface VendorProductsRailProps {
  locale: string
  onNavigate?: () => void
}

export function VendorProductsRail({ locale, onNavigate }: VendorProductsRailProps) {
  const router = useRouter()

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full justify-start" onClick={() => navigate(`/${locale}/vendor/products/add`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Product
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/${locale}/vendor/dashboard`)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            View Dashboard
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Leaf className="h-4 w-4" />
            Product Success Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2"><span className="text-emerald-500">📸</span><p>High-quality photos increase sales by 3x</p></div>
          <div className="flex items-start gap-2"><span className="text-emerald-500">🌱</span><p>Highlight sustainability for DAAR bonuses</p></div>
          <div className="flex items-start gap-2"><span className="text-emerald-500">💰</span><p>Competitive pricing attracts more buyers</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Product Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn how to create compelling product listings</p>
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/${locale}/docs/vendor-guide/products`)}>
            View Product Guide →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
