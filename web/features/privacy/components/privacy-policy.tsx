'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { Button } from '@/components/ui/button'
import { FsModal } from '@/components/ui/fs-modal'
import { ContactForm } from '@/components/common/widgets/contact-form'

/** Horizontal inset for text — mirrors about-publisher's compact form/legal recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

export default function PrivacyPolicy() {
  const t = useTranslations('privacy')
  const { data: session } = useSession()
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <div className={cn('mx-auto max-w-4xl pb-6 pt-4 text-center sm:pt-6', INSET)}>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('privacyPolicyText.title')}
        </h1>
      </div>

      <div className={cn('mx-auto max-w-4xl space-y-5 pb-10', INSET)}>
        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.introduction.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.introduction.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.dataCollection.title')}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.dataCollection.content')}
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li>{t('privacyPolicyText.dataCollection.item1')}</li>
            <li>{t('privacyPolicyText.dataCollection.item2')}</li>
            <li>{t('privacyPolicyText.dataCollection.item3')}</li>
            <li>{t('privacyPolicyText.dataCollection.item4')}</li>
          </ul>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.dataUsage.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.dataUsage.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.dataSecurity.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.dataSecurity.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.userRights.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.userRights.content')}
          </p>
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
          <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
            {t('privacyPolicyText.contactUsPrivacy.title')}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('privacyPolicyText.contactUsPrivacy.content')}
          </p>
          <Button type="button" onClick={() => setContactOpen(true)}>
            {t('privacyPolicyText.contactUsPrivacy.contactStaff')}
          </Button>
        </div>
      </div>

      <FsModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        title={t('privacyPolicyText.contactUsPrivacy.contactStaff')}
        description={t('privacyPolicyText.contactUsPrivacy.content')}
      >
        <ContactForm
          entityId="privacy_page"
          entityName="Privacy Policy"
          initialUserInfo={{
            name: session?.user?.name || '',
            email: session?.user?.email || '',
          }}
        />
      </FsModal>
    </motion.div>
  )
}
