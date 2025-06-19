'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { Card, CardContent } from "@/components/ui/card"
import { Typography } from "@/components/ui/typography"
import { useSession } from 'next-auth/react'

/**
 * AboutUs component
 * Renders the content of the about page
 * 
 * @returns JSX.Element - The rendered AboutUs component
 */
export default function AboutUs() {
  const { t } = useTranslation()
  const { data: session } = useSession()

  // User steps:
  // 1. User views the about page content
  // 2. The component animates in with a fade and slide effect
  // 3. User can read through various sections about the platform
  // 4. The content is responsive and adapts to different screen sizes

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Typography variant="h1" className="text-4xl font-bold mb-12 text-center text-primary">
        {t('aboutUsText.title')}
      </Typography>
      
      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('aboutUsText.introduction.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('aboutUsText.introduction.content')}
          </Typography>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('aboutUsText.forWhom.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('aboutUsText.forWhom.content')}
          </Typography>
          <ul className="list-disc pl-6 mb-6 space-y-4 text-muted-foreground">
            <li>{t('aboutUsText.forWhom.item1')}</li>
            <li>{t('aboutUsText.forWhom.item2')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('aboutUsText.howToUse.title')}
          </Typography>
          <ol className="list-decimal pl-6 mb-6 space-y-4 text-muted-foreground">
            <li>{t('aboutUsText.howToUse.item1')}</li>
            <li>{t('aboutUsText.howToUse.item2')}</li>
            <li>{t('aboutUsText.howToUse.item3')}</li>
            <li>{t('aboutUsText.howToUse.item4')}</li>
            <li>{t('aboutUsText.howToUse.item5')}</li>
            <li>{t('aboutUsText.howToUse.item6')}</li>
            <li>{t('aboutUsText.howToUse.item7')}</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardContent className="pt-6">
          <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
            {t('aboutUsText.techFields.title')}
          </Typography>
          <Typography variant="p" className="mb-6 text-muted-foreground">
            {t('aboutUsText.techFields.content')}
          </Typography>
        </CardContent>
      </Card>

      {session && (
        <Card className="mb-12">
          <CardContent className="pt-6">
            <Typography variant="h2" className="text-2xl font-semibold mb-6 text-primary">
              {t('aboutUsText.userInfo.title')}
            </Typography>
            <Typography variant="p" className="mb-6 text-muted-foreground">
              {t('aboutUsText.userInfo.content', { name: session.user?.name })}
            </Typography>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

