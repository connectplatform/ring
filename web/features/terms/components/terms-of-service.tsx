'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'

/** Horizontal inset for text — mirrors about-publisher's compact form/legal recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
      <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{title}</h2>
      {children}
    </div>
  )
}

export default function TermsOfService() {
  const t = useTranslations('terms')
  const has = (key: string) => {
    try {
      return t.has(key as never)
    } catch {
      return false
    }
  }

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
        <Section title={t('termsOfServiceText.introduction.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.introduction.content')}
          </p>
        </Section>

        {has('termsOfServiceText.eligibility.title') && (
          <Section title={t('termsOfServiceText.eligibility.title')}>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('termsOfServiceText.eligibility.content')}
            </p>
            <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>{t('termsOfServiceText.eligibility.item1')}</li>
              <li>{t('termsOfServiceText.eligibility.item2')}</li>
              <li>{t('termsOfServiceText.eligibility.item3')}</li>
              {has('termsOfServiceText.eligibility.item4') && (
                <li>{t('termsOfServiceText.eligibility.item4')}</li>
              )}
              {has('termsOfServiceText.eligibility.item5') && (
                <li>{t('termsOfServiceText.eligibility.item5')}</li>
              )}
            </ul>
          </Section>
        )}

        <Section title={t('termsOfServiceText.userAgreement.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.userAgreement.content')}
          </p>
        </Section>

        <Section title={t('termsOfServiceText.accountResponsibilities.title')}>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.accountResponsibilities.content')}
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li>{t('termsOfServiceText.accountResponsibilities.item1')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item2')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item3')}</li>
          </ul>
        </Section>

        {has('termsOfServiceText.returns.title') && (
          <Section title={t('termsOfServiceText.returns.title')}>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('termsOfServiceText.returns.content')}
            </p>
            <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>{t('termsOfServiceText.returns.item1')}</li>
              <li>{t('termsOfServiceText.returns.item2')}</li>
              <li>{t('termsOfServiceText.returns.item3')}</li>
              {has('termsOfServiceText.returns.item4') && (
                <li>{t('termsOfServiceText.returns.item4')}</li>
              )}
            </ul>
          </Section>
        )}

        <Section title={t('termsOfServiceText.contentGuidelines.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.contentGuidelines.content')}
          </p>
        </Section>

        <Section title={t('termsOfServiceText.intellectualProperty.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.intellectualProperty.content')}
          </p>
        </Section>

        {has('termsOfServiceText.privacyPolicy.title') && (
          <Section title={t('termsOfServiceText.privacyPolicy.title')}>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('termsOfServiceText.privacyPolicy.content')}
            </p>
          </Section>
        )}

        <Section title={t('termsOfServiceText.limitationOfLiability.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.limitationOfLiability.content')}
          </p>
        </Section>

        <Section title={t('termsOfServiceText.termination.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.termination.content')}
          </p>
        </Section>

        <Section title={t('termsOfServiceText.changes.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.changes.content')}
          </p>
        </Section>

        <Section title={t('termsOfServiceText.contact.title')}>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('termsOfServiceText.contact.content')}
          </p>
        </Section>
      </div>
    </motion.div>
  )
}
