'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"

export default function TermsOfService() {
  const t = useTranslations('terms')

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-12 max-w-4xl"
    >
      <Typography variant="h1" className="text-4xl font-bold mb-12 text-center text-primary">
        {t('termsOfServiceText.title')}
      </Typography>
      
      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.introduction.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.introduction.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.userAgreement.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.userAgreement.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.accountResponsibilities.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.accountResponsibilities.content')}
          </Typography>
          <ul className="list-disc pl-6 mb-6 space-y-4 text-muted-foreground">
            <li>{t('termsOfServiceText.accountResponsibilities.item1')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item2')}</li>
            <li>{t('termsOfServiceText.accountResponsibilities.item3')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.contentGuidelines.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.contentGuidelines.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.intellectualProperty.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.intellectualProperty.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.limitationOfLiability.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.limitationOfLiability.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.termination.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.termination.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.changes.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.changes.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('termsOfServiceText.contact.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('termsOfServiceText.contact.content')}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  )
}