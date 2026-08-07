'use client'

/**
 * PRODUCT FORM WRAPPER — DaVinci SSOT via RingRightRailLayout + DavinciCenterPane
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { Sparkles } from 'lucide-react'

interface ProductFormWrapperProps {
  children: React.ReactNode
  locale: string
  mode: 'create' | 'edit'
}

export default function ProductFormWrapper({
  children,
  locale,
  mode,
}: ProductFormWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const goToGuide = useCallback(
    () => router.push(`/${locale}/docs/vendor-guide/products`),
    [locale, router],
  )

  const tips = [
    { icon: '📸', title: 'Professional Photos', description: 'Upload 1-5 high-quality photos. First photo becomes main display.' },
    { icon: '✍️', title: 'Detailed Description', description: 'Highlight benefits, features, and care instructions.' },
    { icon: '💰', title: 'Competitive Pricing', description: 'Fair prices reflecting quality and sustainability.' },
    { icon: '🌱', title: 'Regenerative Practices', description: 'Earn up to 25% DAAR bonuses for sustainability.' },
    { icon: '📦', title: 'Stock Management', description: 'Keep inventory updated to prevent overselling.' },
  ]

  const rightRail = useMemo(
    () => (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              {mode === 'create' ? 'Creation Tips' : 'Editing Tips'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tips.map((tip) => (
              <div key={tip.title} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{tip.icon}</span>
                  <div>
                    <h4 className="mb-1 text-sm font-medium">{tip.title}</h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">{tip.description}</p>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={goToGuide}>
              View Guide →
            </Button>
          </CardContent>
        </Card>
      </div>
    ),
    [mode, goToGuide],
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <RingRightRailLayout
      showRightRail
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={rightRail}
    >
      <DavinciCenterPane>{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}
