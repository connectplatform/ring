'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'

/** Horizontal inset for text — mirrors about-publisher's compact form/legal recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

export default function TermsOfService() {
  const t = useTranslations('terms')

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <div className={cn('mx-auto max-w-4xl pb-6 pt-4 text-center sm:pt-6', INSET)}>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('termsOfServiceText.title')}
        </h1>
      </div>

      <div className={cn('mx-auto max-w-4xl space-y-5 pb-10', INSET)}>
        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.introduction.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.introduction.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.userAgreement.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.userAgreement.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.accountResponsibilities.title')}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.accountResponsibilities.content')}
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li>{t('termsOfServiceText.accountResponsibilities.item1')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item2')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item3')}</li>
          </ul>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.contentGuidelines.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.contentGuidelines.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.intellectualProperty.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.intellectualProperty.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.limitationOfLiability.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.limitationOfLiability.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.termination.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.termination.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.changes.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.changes.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('termsOfServiceText.contact.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.contact.content')}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
