/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import EntityStatusPage from '../../components/entities/EntityStatusPage'
import type { Locale } from '../../i18n-config'
import { jest } from '@jest/globals'

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock ROUTES constants
jest.mock('@/constants/routes', () => ({
  ROUTES: {
    ENTITIES: (locale: string) => `/${locale}/entities`,
    ENTITY: (id: string, locale: string) => `/${locale}/entities/${id}`,
    ADD_ENTITY: (locale: string) => `/${locale}/entities/add`,
    CONTACT: (locale: string) => `/${locale}/contact`,
  }
}))

// Mock translations
const mockTranslations = {
  en: {
    'modules.entities.status': {
      'entityName': 'Entity Name',
      'entityId': 'Entity ID',
      'reviewId': 'Review ID',
      'rejectionReason': 'Rejection Reason',
      'needHelp': 'Need help? Contact our support team',
      'actions.viewEntity': 'View Entity',
      'actions.backToEntities': 'Back to Entities',
      'actions.continueEditing': 'Continue Editing',
      'actions.createNew': 'Create New Entity',
      'actions.contactSupport': 'Contact Support',
      'actions.reviseEntity': 'Revise Entity',
      'actions.checkStatus': 'Check Status',
      'actions.viewScheduled': 'View Scheduled',
      'actions.manageEntity': 'Manage Entity',
      'actions.resubmit': 'Resubmit',
      
      // Create statuses
      'create.draft.title': 'Entity Draft Saved',
      'create.draft.description': 'Your entity has been saved as a draft.',
      'create.draft.instruction': 'Complete all required fields and submit your entity for review when ready.',
      'create.pending_review.title': 'Entity Pending Review',
      'create.pending_review.description': 'Your entity has been submitted and is awaiting review.',
      'create.published.title': 'Entity Published!',
      'create.published.description': 'Your entity has been successfully published.',
      'create.failed.title': 'Entity Creation Failed',
      'create.failed.description': 'We couldn\'t create your entity due to a technical issue.',
      'create.rejected.title': 'Entity Rejected',
      'create.rejected.description': 'Your entity submission was rejected during the review process.',
      
      // Verify statuses
      'verify.pending.title': 'Verification Pending',
      'verify.pending.description': 'Your entity verification request has been submitted.',
      'verify.under_review.title': 'Under Verification Review',
      'verify.under_review.description': 'Our verification team is currently reviewing your entity\'s documentation.',
      'verify.under_review.reviewing': 'Reviewing verification documents...',
      'verify.verified.title': 'Entity Verified!',
      'verify.verified.description': 'Your entity has been successfully verified.',
      'verify.rejected.title': 'Verification Rejected',
      'verify.rejected.description': 'Your entity verification was rejected.',
      'verify.expired.title': 'Verification Expired',
      'verify.expired.description': 'Your entity verification has expired.',
      
      // Approve statuses
      'approve.pending.title': 'Approval Pending',
      'approve.pending.description': 'Your entity is pending administrative approval.',
      'approve.approved.title': 'Entity Approved!',
      'approve.approved.description': 'Your entity has been approved by our administrative team.',
      'approve.rejected.title': 'Approval Rejected',
      'approve.rejected.description': 'Your entity was not approved during the administrative review.',
      'approve.needs_revision.title': 'Revision Required',
      'approve.needs_revision.description': 'Your entity requires revisions before it can be approved.',
      
      // Publish statuses
      'publish.scheduled.title': 'Publication Scheduled',
      'publish.scheduled.description': 'Your entity is scheduled for publication.',
      'publish.scheduled.scheduleInfo': 'Your entity will be automatically published according to the schedule.',
      'publish.published.title': 'Entity Published!',
      'publish.published.description': 'Your entity is now live and visible to all platform users.',
      'publish.failed.title': 'Publication Failed',
      'publish.failed.description': 'We encountered an error while publishing your entity.',
      'publish.unpublished.title': 'Entity Unpublished',
      'publish.unpublished.description': 'Your entity has been unpublished.',
      'publish.archived.title': 'Entity Archived',
      'publish.archived.description': 'Your entity has been archived and moved to storage.'
    },
    'common': {}
  },
  uk: {
    'modules.entities.status': {
      'entityName': 'Назва організації',
      'entityId': 'ID організації',
      'reviewId': 'ID перевірки',
      'rejectionReason': 'Причина відхилення',
      'needHelp': 'Потрібна допомога? Зв\'яжіться з нашою службою підтримки',
      'actions.viewEntity': 'Переглянути організацію',
      'actions.backToEntities': 'Назад до організацій',
      'actions.continueEditing': 'Продовжити редагування',
      'actions.createNew': 'Створити нову організацію',
      'actions.contactSupport': 'Зв\'язатися з підтримкою',
      
      'create.draft.title': 'Чернетку організації збережено',
      'create.draft.description': 'Вашу організацію збережено як чернетку.',
      'verify.under_review.title': 'Розгляд верифікації',
      'verify.under_review.description': 'Наша команда верифікації зараз розглядає документацію.',
      'verify.under_review.reviewing': 'Розгляд документів для верифікації...',
      'publish.published.title': 'Організацію опубліковано!',
      'publish.published.description': 'Ваша організація тепер активна і видима всім користувачам платформи.'
    },
    'common': {}
  }
}

// Helper function to render component with translations
const renderWithTranslations = (component: React.ReactElement, locale: Locale = 'en') => {
  const messages = mockTranslations[locale]
  
  return render(
    <NextIntlClientProvider messages={messages} locale={locale}>
      {component}
    </NextIntlClientProvider>
  )
}

describe('EntityStatusPage', () => {
  describe('Create Status Pages', () => {
    it('renders create draft status correctly', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="draft" locale="en" />
      )
      
      expect(screen.getByText('Entity Draft Saved')).toBeInTheDocument()
      expect(screen.getByText('Your entity has been saved as a draft.')).toBeInTheDocument()
      expect(screen.getByText('Complete all required fields and submit your entity for review when ready.')).toBeInTheDocument()
      expect(screen.getByText('Continue Editing')).toBeInTheDocument()
      expect(screen.getByText('Back to Entities')).toBeInTheDocument()
    })
    
    it('renders create published status', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" />
      )
      
      expect(screen.getByText('Entity Published!')).toBeInTheDocument()
      expect(screen.getByText('Your entity has been successfully published.')).toBeInTheDocument()
      expect(screen.getByText('Back to Entities')).toBeInTheDocument()
    })
    
    it('renders create rejected status with support option', () => {
      renderWithTranslations(
        <EntityStatusPage 
          action="create" 
          status="rejected" 
          locale="en" 
          reason="Missing required documentation"
        />
      )
      
      expect(screen.getByText('Entity Rejected')).toBeInTheDocument()
      expect(screen.getByText('Rejection Reason')).toBeInTheDocument()
      expect(screen.getByText('Missing required documentation')).toBeInTheDocument()
      expect(screen.getByText('Create New Entity')).toBeInTheDocument()
      expect(screen.getByText('Contact Support')).toBeInTheDocument()
    })
  })

  describe('Verify Status Pages', () => {
    it('renders verify pending status', () => {
      renderWithTranslations(
        <EntityStatusPage action="verify" status="pending" locale="en" />
      )
      
      expect(screen.getByText('Verification Pending')).toBeInTheDocument()
      expect(screen.getByText('Your entity verification request has been submitted.')).toBeInTheDocument()
    })
    
    it('renders verify under review with animated spinner', () => {
      const { container } = renderWithTranslations(
        <EntityStatusPage action="verify" status="under_review" locale="en" />
      )
      
      expect(screen.getByText('Under Verification Review')).toBeInTheDocument()
      expect(screen.getByText('Reviewing verification documents...')).toBeInTheDocument()
      
      // Check for animated spinner
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
    
    it('renders verify verified status with success icon', () => {
      renderWithTranslations(
        <EntityStatusPage action="verify" status="verified" locale="en" />
      )
      
      expect(screen.getByText('Entity Verified!')).toBeInTheDocument()
      expect(screen.getByText('Your entity has been successfully verified.')).toBeInTheDocument()
    })
  })

  describe('Approve Status Pages', () => {
    it('renders approve pending status', () => {
      renderWithTranslations(
        <EntityStatusPage action="approve" status="pending" locale="en" />
      )
      
      expect(screen.getByText('Approval Pending')).toBeInTheDocument()
      expect(screen.getByText('Your entity is pending administrative approval.')).toBeInTheDocument()
    })
    
    it('renders approve approved status', () => {
      renderWithTranslations(
        <EntityStatusPage action="approve" status="approved" locale="en" />
      )
      
      expect(screen.getByText('Entity Approved!')).toBeInTheDocument()
      expect(screen.getByText('Your entity has been approved by our administrative team.')).toBeInTheDocument()
    })
    
    it('renders approve needs revision status', () => {
      renderWithTranslations(
        <EntityStatusPage action="approve" status="needs_revision" locale="en" />
      )
      
      expect(screen.getByText('Revision Required')).toBeInTheDocument()
      expect(screen.getByText('Revise Entity')).toBeInTheDocument()
    })
  })

  describe('Publish Status Pages', () => {
    it('renders publish scheduled status', () => {
      renderWithTranslations(
        <EntityStatusPage action="publish" status="scheduled" locale="en" />
      )
      
      expect(screen.getByText('Publication Scheduled')).toBeInTheDocument()
      expect(screen.getByText('Your entity will be automatically published according to the schedule.')).toBeInTheDocument()
    })
    
    it('renders publish published status', () => {
      renderWithTranslations(
        <EntityStatusPage action="publish" status="published" locale="en" />
      )
      
      expect(screen.getByText('Entity Published!')).toBeInTheDocument()
      expect(screen.getByText('Your entity is now live and visible to all platform users.')).toBeInTheDocument()
    })
    
    it('renders publish archived status', () => {
      renderWithTranslations(
        <EntityStatusPage action="publish" status="archived" locale="en" />
      )
      
      expect(screen.getByText('Entity Archived')).toBeInTheDocument()
      expect(screen.getByText('Manage Entity')).toBeInTheDocument()
    })
  })

  describe('Entity Information Display', () => {
    it('displays entity name when provided', () => {
      renderWithTranslations(
        <EntityStatusPage 
          action="create" 
          status="published" 
          locale="en" 
          entityName="Tech Innovation Corp"
        />
      )
      
      expect(screen.getByText('Entity Name')).toBeInTheDocument()
      expect(screen.getByText('Tech Innovation Corp')).toBeInTheDocument()
    })
    
    it('displays entity ID when provided', () => {
      renderWithTranslations(
        <EntityStatusPage 
          action="verify" 
          status="verified" 
          locale="en" 
          entityId="ENT-12345"
        />
      )
      
      expect(screen.getByText('Entity ID')).toBeInTheDocument()
      expect(screen.getByText('ENT-12345')).toBeInTheDocument()
    })
    
    it('displays review ID when provided', () => {
      renderWithTranslations(
        <EntityStatusPage 
          action="approve" 
          status="pending" 
          locale="en" 
          reviewId="REV-67890"
        />
      )
      
      expect(screen.getByText('Review ID')).toBeInTheDocument()
      expect(screen.getByText('REV-67890')).toBeInTheDocument()
    })
  })

  describe('Internationalization', () => {
    it('renders correctly in Ukrainian', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="draft" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Чернетку організації збережено')).toBeInTheDocument()
      expect(screen.getByText('Вашу організацію збережено як чернетку.')).toBeInTheDocument()
    })
    
    it('renders verify status correctly in Ukrainian', () => {
      renderWithTranslations(
        <EntityStatusPage action="verify" status="under_review" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Розгляд верифікації')).toBeInTheDocument()
      expect(screen.getByText('Розгляд документів для верифікації...')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('generates correct navigation links for draft status', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="draft" locale="en" />
      )
      
      const editingLink = screen.getByRole('link', { name: 'Continue Editing' })
      expect(editingLink).toHaveAttribute('href', '/en/entities/add')
      
      const entitiesLink = screen.getByRole('link', { name: 'Back to Entities' })
      expect(entitiesLink).toHaveAttribute('href', '/en/entities')
    })
    
    it('renders help link', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="draft" locale="en" />
      )
      
      const helpLink = screen.getByRole('link', { name: 'Need help? Contact our support team' })
      expect(helpLink).toHaveAttribute('href', '/en/contact')
    })
  })

  describe('Icons and Visual Elements', () => {
    it('renders appropriate icons for different statuses', () => {
      const { container: publishedContainer } = renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" />
      )
      // Check if success icon is rendered
      expect(publishedContainer.querySelector('svg')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <EntityStatusPage action="create" status="failed" locale="en" />
      )
      expect(failedContainer.querySelector('svg')).toBeInTheDocument()
    })
    
    it('applies correct color themes for different statuses', () => {
      const { container: publishedContainer } = renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" />
      )
      
      // Check for success styling (green theme)
      expect(publishedContainer.querySelector('.bg-green-50')).toBeInTheDocument()
      expect(publishedContainer.querySelector('.text-green-500')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <EntityStatusPage action="create" status="failed" locale="en" />
      )
      
      // Check for error styling (red theme)
      expect(failedContainer.querySelector('.bg-red-50')).toBeInTheDocument()
      expect(failedContainer.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Return URL Handling', () => {
    it('uses return URL when provided for published status', () => {
      renderWithTranslations(
        <EntityStatusPage 
          action="create" 
          status="published" 
          locale="en" 
          returnTo="/dashboard" 
        />
      )
      
      const backLink = screen.getByRole('link', { name: 'Back to Entities' })
      expect(backLink).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('Action-Specific Behaviors', () => {
    it('shows different actions for different statuses', () => {
      // Draft status shows continue editing
      renderWithTranslations(
        <EntityStatusPage action="create" status="draft" locale="en" />
      )
      expect(screen.getByText('Continue Editing')).toBeInTheDocument()
      
      // Published status shows view entity
      const { rerender } = renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" entityId="123" />
      )
      expect(screen.getByText('View Entity')).toBeInTheDocument()
      
      // Needs revision shows revise entity
      rerender(
        <NextIntlClientProvider messages={mockTranslations.en} locale="en">
          <EntityStatusPage action="approve" status="needs_revision" locale="en" entityId="123" />
        </NextIntlClientProvider>
      )
      expect(screen.getByText('Revise Entity')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" />
      )
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Entity Published!')
    })
    
    it('has accessible button and link roles', () => {
      renderWithTranslations(
        <EntityStatusPage action="create" status="published" locale="en" />
      )
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
    })
  })
})
