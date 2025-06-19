'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession, SessionProvider } from 'next-auth/react'
import { SlidingPopup } from '@/components/widgets/modal'
import { ContactForm } from '@/components/widgets/contact-form'
import { Entity } from '@/types'
import { Button } from '@/components/ui/button'
import { Lock, Building, Users, Calendar, MapPin, Phone, Mail, Globe, FileText } from 'lucide-react'

function ConfidentialEntityDetailsContent({ initialEntity }: { initialEntity: Entity }) {
  const { data: session } = useSession()
  const { t } = useTranslation()
  const [entity] = useState<Entity>(initialEntity)
  const [isWebsitePopupOpen, setIsWebsitePopupOpen] = useState(false)
  const [isContactPopupOpen, setIsContactPopupOpen] = useState(false)

  const handleCloseWebsitePopup = async () => {
    setIsWebsitePopupOpen(false)
  }

  const handleCloseContactPopup = async () => {
    setIsContactPopupOpen(false)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center mb-8"
      >
        <Lock className="w-8 h-8 text-destructive mr-2" />
        <h1 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500">
          {entity.name}
        </h1>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          {entity.logo && (
            <Image src={entity.logo} alt={entity.name} width={300} height={300} className="rounded-lg mb-4 shadow-lg" />
          )}
          <p className="text-lg mb-4 text-gray-700">{entity.shortDescription}</p>
          {entity.tags && (
            <div className="flex flex-wrap gap-2 mb-4">
              {entity.tags.map((tag: string) => (
                <span key={tag} className="bg-gradient-to-r from-red-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm shadow">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {entity.fullDescription && <p className="mb-4 text-gray-600">{entity.fullDescription}</p>}
          <div className="flex gap-4">
            {entity.website && (
              <Button
                onClick={() => setIsWebsitePopupOpen(true)}
                className="bg-gradient-to-r from-red-500 to-purple-500 text-white px-6 py-2 rounded-full font-semibold hover:from-red-600 hover:to-purple-600 transition-colors shadow-lg"
              >
                {t('entity.visitWebsite')}
              </Button>
            )}
            <Button
              onClick={() => setIsContactPopupOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full font-semibold hover:from-purple-600 hover:to-pink-600 transition-colors shadow-lg"
            >
              {t('entity.connect')}
            </Button>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
            {t('entity.confidentialDetails')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <Building className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.type')}: {entity.type}</span>
            </div>
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.employeeCount')}: {entity.employeeCount}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.foundedYear')}: {entity.foundedYear}</span>
            </div>
            <div className="flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.location')}: {entity.location}</span>
            </div>
            <div className="flex items-center">
              <Phone className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.phoneNumber')}: {entity.phoneNumber}</span>
            </div>
            <div className="flex items-center">
              <Mail className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.contactEmail')}: {entity.contactEmail}</span>
            </div>
            <div className="flex items-center">
              <Globe className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.website')}: {entity.website}</span>
            </div>
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700">{t('entity.certifications')}: {entity.certifications?.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
      {entity.gallery && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
            {t('entity.imageGallery')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {entity.gallery.map((image: { url: string; description: string }, index: number) => (
              <div key={index} className="relative group">
                <Image src={image.url} alt={image.description} width={300} height={200} className="rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105" />
                <p className="mt-2 text-sm text-gray-600 group-hover:text-gray-800 transition-colors duration-300">{image.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {entity.website && (
        <SlidingPopup isOpen={isWebsitePopupOpen} onCloseAction={handleCloseWebsitePopup}>
          <iframe src={entity.website} className="w-full h-full rounded-lg shadow-lg" title={entity.name} />
        </SlidingPopup>
      )}
      <SlidingPopup isOpen={isContactPopupOpen} onCloseAction={handleCloseContactPopup}>
        <ContactForm 
          entityId={entity.id} 
          entityName={entity.name}
          initialUserInfo={{
            name: session?.user?.name || '',
            email: session?.user?.email || ''
          }}
        />
      </SlidingPopup>
    </div>
  )
}

export default function ConfidentialEntityDetails({ initialEntity }: { initialEntity: Entity }) {
  return (
    <SessionProvider>
      <ConfidentialEntityDetailsContent initialEntity={initialEntity} />
    </SessionProvider>
  )
}
