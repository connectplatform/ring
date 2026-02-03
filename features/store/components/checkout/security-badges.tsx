'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Shield, Lock, CheckCircle, Award } from 'lucide-react'

export function SecurityBadges() {
  const t = useTranslations('modules.store.checkout')

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-4 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-5 w-5 text-green-600 dark:text-green-500" />
        <h3 className="font-semibold text-foreground">{t('securityAssurance')}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {/* PCI DSS Compliance */}
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">{t('pciCompliant')}</span>
        </div>

        {/* SSL Secured */}
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">{t('sslSecured')}</span>
        </div>

        {/* ISO 27001 */}
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">ISO 27001</span>
        </div>

        {/* SOC 2 Type II */}
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">SOC 2 Type II</span>
        </div>

        {/* GDPR Compliant */}
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">GDPR {t('compliant')}</span>
        </div>

        {/* 256-bit Encryption */}
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">256-bit {t('encryption')}</span>
        </div>
      </div>

      {/* Money Back Guarantee */}
      <div className="border-t border-border pt-3 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary" />
          <span>{t('moneyBack')}</span>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full"></div>
          <span>{t('secureConnection')}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full"></div>
          <span>{t('dataProtected')}</span>
        </div>
      </div>
    </div>
  )
}

interface CompactSecurityBadgesProps {
  className?: string
}

export function CompactSecurityBadges({ className = '' }: CompactSecurityBadgesProps) {
  const t = useTranslations('modules.store.checkout')

  return (
    <div className={`flex items-center gap-3 text-xs text-muted-foreground ${className}`}>
      <div className="flex items-center gap-1">
        <Lock className="h-3 w-3 text-green-600 dark:text-green-500" />
        <span>SSL</span>
      </div>
      <div className="flex items-center gap-1">
        <Shield className="h-3 w-3 text-green-600 dark:text-green-500" />
        <span>PCI DSS</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-500" />
        <span>GDPR</span>
      </div>
    </div>
  )
}
