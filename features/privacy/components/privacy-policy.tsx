'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { Card, CardContent } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"

export default function PrivacyPolicy() {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-12 max-w-4xl"
    >
      <Typography variant="h1" className="text-4xl font-bold mb-12 text-center text-primary">
        {t('privacyPolicyText.title')}
      </Typography>
      
      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.introduction.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.introduction.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.dataCollection.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.dataCollection.content')}
          </Typography>
          <ul className="list-disc pl-6 mb-6 space-y-4 text-muted-foreground">
            <li>{t('privacyPolicyText.dataCollection.item1')}</li>
            <li>{t('privacyPolicyText.dataCollection.item2')}</li>
            <li>{t('privacyPolicyText.dataCollection.item3')}</li>
            <li>{t('privacyPolicyText.dataCollection.item4')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.dataUsage.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.dataUsage.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.dataSecurity.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.dataSecurity.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.userRights.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.userRights.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('privacyPolicyText.contactUsPrivacy.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('privacyPolicyText.contactUsPrivacy.content')}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  )
}