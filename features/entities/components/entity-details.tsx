'use client'

import React, { useState } from 'react'
import { EntityLogo } from '@/components/ui/safe-image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { SlidingPopup } from '@/components/common/widgets/modal'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { SerializedEntity } from '@/features/entities/types'
import { Building, Users, Calendar, MapPin, Phone, Mail, Globe, MessageCircle } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface EntityDetailsProps {
  initialEntity: SerializedEntity | null
  initialError: string | null
  chatComponent: React.ReactNode
}

/**
 * EntityDetails component
 * Displays detailed information about an entity
 * 
 * @param {EntityDetailsProps} props - Component props
 * @returns {React.ReactElement} Rendered EntityDetails component
 */
export default function EntityDetails({ initialEntity, initialError, chatComponent }: EntityDetailsProps) {
  const t = useTranslations('modules.entities')
  const [entity] = useState<SerializedEntity | null>(initialEntity)
  const [error] = useState<string | null>(initialError)
  const [isWebsitePopupOpen, setIsWebsitePopupOpen] = useState(false)
  const [isContactPopupOpen, setIsContactPopupOpen] = useState(false)
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false)

  const handleCloseWebsitePopup = async () => {
    setIsWebsitePopupOpen(false)
  }

  const handleCloseContactPopup = async () => {
    setIsContactPopupOpen(false)
  }

  const handleCloseChatPopup = async () => {
    setIsChatPopupOpen(false)
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    )
  }

  if (!entity) {
    return (
      <Alert>
        <AlertTitle>{t('entityNotFound')}</AlertTitle>
      </Alert>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-card text-card-foreground rounded-lg shadow-lg p-6"
    >
      <EntityHeader entity={entity} />
      <EntityDescription description={entity.shortDescription} />
      <EntityDetailsGrid 
        entity={entity} 
        t={t} 
        onWebsiteClick={() => setIsWebsitePopupOpen(true)}
      />
      <EntityFullDescription description={entity.fullDescription} t={t} />
      <EntityServices services={entity.services} t={t} />
      <EntityActions 
        onContactClick={() => setIsContactPopupOpen(true)}
        onChatClick={() => setIsChatPopupOpen(true)}
        t={t}
      />

      {entity.website && (
        <WebsitePopup 
          isOpen={isWebsitePopupOpen} 
          onCloseAction={handleCloseWebsitePopup}
          website={entity.website}
          t={t}
        />
      )}

      <ContactPopup 
        isOpen={isContactPopupOpen} 
        onCloseAction={handleCloseContactPopup}
        entity={entity}
        t={t}
      />

      <ChatPopup 
        isOpen={isChatPopupOpen} 
        onCloseAction={handleCloseChatPopup}
        entityName={entity.name}
        chatComponent={chatComponent}
        t={t}
      />
    </motion.div>
  )
}

interface EntityHeaderProps {
  entity: SerializedEntity
}

const EntityHeader: React.FC<EntityHeaderProps> = ({ entity }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
    <h1 className="text-3xl font-bold mb-2 md:mb-0">{entity.name}</h1>
    <EntityLogo
      src={entity.logo}
      entityName={entity.name}
      size="md"
      className="rounded-full"
    />
  </div>
)

interface EntityDescriptionProps {
  description: string
}

const EntityDescription: React.FC<EntityDescriptionProps> = ({ description }) => (
  <p className="text-lg mb-6">{description}</p>
)

interface EntityDetailsGridProps {
  entity: SerializedEntity
  t: any // Use any to match useTranslations return type
  onWebsiteClick: () => void
}

const EntityDetailsGrid: React.FC<EntityDetailsGridProps> = ({ entity, t, onWebsiteClick }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('details')}</h2>
      <ul className="space-y-2">
        <li className="flex items-center">
          <Building className="w-5 h-5 mr-2" />
          <span>{entity.type}</span>
        </li>
        <li className="flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          <span>{entity.location}</span>
        </li>
        {entity.foundedYear && (
          <li className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            <span>{t('foundedIn', { year: entity.foundedYear })}</span>
          </li>
        )}
        {entity.employeeCount && (
          <li className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            <span>{t('employees', { count: entity.employeeCount })}</span>
          </li>
        )}
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-semibold mb-4">{t('contact')}</h2>
      <ul className="space-y-2">
        {entity.phoneNumber && (
          <li className="flex items-center">
            <Phone className="w-5 h-5 mr-2" />
            <a href={`tel:${entity.phoneNumber}`} className="hover:underline">
              {entity.phoneNumber}
            </a>
          </li>
        )}
        {entity.contactEmail && (
          <li className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            <a href={`mailto:${entity.contactEmail}`} className="hover:underline">
              {entity.contactEmail}
            </a>
          </li>
        )}
        {entity.website && (
          <li className="flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            <Button
              variant="link"
              onClick={onWebsiteClick}
              className="p-0 h-auto"
            >
              {t('visitWebsite')}
            </Button>
          </li>
        )}
      </ul>
    </div>
  </div>
)

interface EntityFullDescriptionProps {
  description: string | undefined
  t: (key: string) => string
}

const EntityFullDescription: React.FC<EntityFullDescriptionProps> = ({ description, t }) => {
  if (!description) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">{t('about')}</h2>
      <p>{description}</p>
    </div>
  )
}

interface EntityServicesProps {
  services: string[] | undefined
  t: (key: string) => string
}

const EntityServices: React.FC<EntityServicesProps> = ({ services, t }) => {
  if (!services || services.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">{t('services')}</h2>
      <ul className="list-disc list-inside">
        {services.map((service, index) => (
          <li key={index}>{service}</li>
        ))}
      </ul>
    </div>
  )
}

interface EntityActionsProps {
  onContactClick: () => void
  onChatClick: () => void
  t: (key: string) => string
}

const EntityActions: React.FC<EntityActionsProps> = ({ onContactClick, onChatClick, t }) => (
  <div className="mt-6 flex justify-end space-x-4">
    <Button onClick={onContactClick}>
      {t('contactUs')}
    </Button>
    <Button onClick={onChatClick}>
      <MessageCircle className="w-5 h-5 mr-2" />
      {t('chat')}
    </Button>
  </div>
)

interface WebsitePopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  website: string
  t: (key: string) => string
}

const WebsitePopup: React.FC<WebsitePopupProps> = ({ isOpen, onCloseAction, website, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('externalWebsite')}</h2>
      <p className="mb-4">{t('externalWebsiteWarning')}</p>
      <Button
        onClick={() => {
          window.open(website, '_blank', 'noopener,noreferrer')
        }}
      >
        {t('continueToWebsite')}
      </Button>
    </div>
  </SlidingPopup>
)

interface ContactPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  entity: SerializedEntity
  t: any // Use any to match useTranslations return type
}

const ContactPopup: React.FC<ContactPopupProps> = ({ isOpen, onCloseAction, entity, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('contactEntity', { name: entity.name })}</h2>
      <ContactForm 
        entityId={entity.id} 
        entityName={entity.name}
        initialUserInfo={{
          name: '',
          email: ''
        }}
      />
    </div>
  </SlidingPopup>
)

interface ChatPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  entityName: string
  chatComponent: React.ReactNode
  t: any // Use any to match useTranslations return type
}

const ChatPopup: React.FC<ChatPopupProps> = ({ isOpen, onCloseAction, entityName, chatComponent, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('chatWith', { name: entityName })}</h2>
      {chatComponent}
    </div>
  </SlidingPopup>
)
