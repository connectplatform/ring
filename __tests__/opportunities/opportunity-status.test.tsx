/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import OpportunityStatusPage from '../../components/opportunities/OpportunityStatusPage'
import type { Locale } from '../../i18n-config'
import  {  describe,  it,  expect,  jest  }  from  '@jest/globals'
import '@testing-library/jest-dom'

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock ROUTES constants
jest.mock('@/constants/routes', () => ({
  ROUTES: {
    OPPORTUNITIES: (locale: string) => `/${locale}/opportunities`,
    OPPORTUNITY: (id: string, locale: string) => `/${locale}/opportunities/${id}`,
    ADD_OPPORTUNITY: (locale: string) => `/${locale}/opportunities/add`,
    CONTACT: (locale: string) => `/${locale}/contact`,
  }
}))

// Mock translations
const mockTranslations = {
  en: {
    'modules.opportunities.status': {
      'opportunityTitle': 'Opportunity Title',
      'applicationId': 'Application ID',
      'submissionId': 'Submission ID',
      'reviewId': 'Review ID',
      'rejectionReason': 'Rejection Reason',
      'changesRequired': 'Changes Required',
      'nextStep': 'Next Step',
      'needHelp': 'Need help? Contact our support team',
      
      'actions.viewOpportunity': 'View Opportunity',
      'actions.viewApplication': 'View Application',
      'actions.backToOpportunities': 'Back to Opportunities',
      'actions.continueEditing': 'Continue Editing',
      'actions.createNew': 'Create New Opportunity',
      'actions.contactSupport': 'Contact Support',
      'actions.applyAgain': 'Apply Again',
      'actions.makeChanges': 'Make Changes',
      'actions.uploadDocuments': 'Upload Documents',
      'actions.checkStatus': 'Check Status',
      'actions.viewMyApplications': 'View My Applications',
      'actions.viewScheduled': 'View Scheduled',
      'actions.manageOpportunity': 'Manage Opportunity',
      
      // Create statuses
      'create.draft.title': 'Opportunity Draft Saved',
      'create.draft.description': 'Your opportunity has been saved as a draft.',
      'create.draft.instruction': 'Complete all required fields and submit your opportunity for review when ready.',
      'create.published.title': 'Opportunity Published!',
      'create.published.description': 'Your opportunity has been successfully published.',
      'create.failed.title': 'Opportunity Creation Failed',
      'create.failed.description': 'We couldn\'t create your opportunity due to a technical issue.',
      'create.rejected.title': 'Opportunity Rejected',
      'create.rejected.description': 'Your opportunity submission was rejected during the review process.',
      
      // Apply statuses
      'apply.submitted.title': 'Application Submitted!',
      'apply.submitted.description': 'Your application has been successfully submitted.',
      'apply.under_review.title': 'Application Under Review',
      'apply.under_review.description': 'Your application is currently being reviewed.',
      'apply.under_review.reviewing': 'Reviewing your application...',
      'apply.accepted.title': 'Application Accepted!',
      'apply.accepted.description': 'Congratulations! Your application has been accepted.',
      'apply.rejected.title': 'Application Not Selected',
      'apply.rejected.description': 'Unfortunately, your application was not selected.',
      'apply.pending_documents.title': 'Documents Required',
      'apply.pending_documents.description': 'Your application is on hold pending additional documentation.',
      'apply.pending_documents.documentsNeeded': 'Please upload the requested documents to complete your application.',
      
      // Submit statuses
      'submit.received.title': 'Submission Received',
      'submit.received.description': 'Your submission has been received and logged in our system.',
      'submit.processing.title': 'Processing Submission',
      'submit.processing.description': 'Your submission is currently being processed.',
      'submit.approved.title': 'Submission Approved!',
      'submit.approved.description': 'Your submission has been approved.',
      'submit.requires_changes.title': 'Changes Required',
      'submit.requires_changes.description': 'Your submission requires modifications.',
      'submit.rejected.title': 'Submission Rejected',
      'submit.rejected.description': 'Your submission was rejected.',
      
      // Approve statuses
      'approve.pending.title': 'Approval Pending',
      'approve.pending.description': 'Your opportunity is pending administrative approval.',
      'approve.approved.title': 'Opportunity Approved!',
      'approve.approved.description': 'Your opportunity has been approved.',
      'approve.rejected.title': 'Approval Rejected',
      'approve.rejected.description': 'Your opportunity was not approved.',
      'approve.needs_revision.title': 'Revision Required',
      'approve.needs_revision.description': 'Your opportunity requires revisions.',
      
      // Publish statuses
      'publish.scheduled.title': 'Publication Scheduled',
      'publish.scheduled.description': 'Your opportunity is scheduled for publication.',
      'publish.published.title': 'Opportunity Published!',
      'publish.published.description': 'Your opportunity is now live and visible to all platform users.',
      'publish.failed.title': 'Publication Failed',
      'publish.failed.description': 'We encountered an error while publishing your opportunity.',
      'publish.unpublished.title': 'Opportunity Unpublished',
      'publish.unpublished.description': 'Your opportunity has been unpublished.'
    },
    'common': {}
  },
  uk: {
    'modules.opportunities.status': {
      'opportunityTitle': 'Назва можливості',
      'applicationId': 'ID заявки',
      'submissionId': 'ID подання',
      'reviewId': 'ID перевірки',
      'rejectionReason': 'Причина відхилення',
      'changesRequired': 'Потрібні зміни',
      'nextStep': 'Наступний крок',
      'needHelp': 'Потрібна допомога? Зв\'яжіться з нашою службою підтримки',
      
      'actions.viewOpportunity': 'Переглянути можливість',
      'actions.backToOpportunities': 'Назад до можливостей',
      'actions.continueEditing': 'Продовжити редагування',
      'actions.createNew': 'Створити нову можливість',
      
      'create.draft.title': 'Чернетку можливості збережено',
      'create.draft.description': 'Вашу можливість збережено як чернетку.',
      'apply.under_review.title': 'Заявка на розгляді',
      'apply.under_review.description': 'Вашу заявку зараз розглядає власник можливості.',
      'apply.under_review.reviewing': 'Розгляд вашої заявки...',
      'publish.published.title': 'Можливість опубліковано!',
      'publish.published.description': 'Ваша можливість тепер активна і видима всім користувачам платформи.'
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

describe('OpportunityStatusPage', () => {
  describe('Create Status Pages', () => {
    it('renders create draft status correctly', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="draft" locale="en" />
      )
      
      expect(screen.getByText('Opportunity Draft Saved')).toBeInTheDocument()
      expect(screen.getByText('Your opportunity has been saved as a draft.')).toBeInTheDocument()
      expect(screen.getByText('Complete all required fields and submit your opportunity for review when ready.')).toBeInTheDocument()
      expect(screen.getByText('Continue Editing')).toBeInTheDocument()
      expect(screen.getByText('Back to Opportunities')).toBeInTheDocument()
    })
    
    it('renders create published status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" />
      )
      
      expect(screen.getByText('Opportunity Published!')).toBeInTheDocument()
      expect(screen.getByText('View Opportunity')).toBeInTheDocument()
    })
    
    it('renders create rejected status with feedback', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="create" 
          status="rejected" 
          locale="en" 
          reason="Missing required information"
        />
      )
      
      expect(screen.getByText('Opportunity Rejected')).toBeInTheDocument()
      expect(screen.getByText('Rejection Reason')).toBeInTheDocument()
      expect(screen.getByText('Missing required information')).toBeInTheDocument()
      expect(screen.getByText('Create New Opportunity')).toBeInTheDocument()
    })
  })

  describe('Apply Status Pages', () => {
    it('renders apply submitted status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="apply" status="submitted" locale="en" />
      )
      
      expect(screen.getByText('Application Submitted!')).toBeInTheDocument()
      expect(screen.getByText('Your application has been successfully submitted.')).toBeInTheDocument()
      expect(screen.getByText('View My Applications')).toBeInTheDocument()
    })
    
    it('renders apply under review with animated spinner', () => {
      const { container } = renderWithTranslations(
        <OpportunityStatusPage action="apply" status="under_review" locale="en" />
      )
      
      expect(screen.getByText('Application Under Review')).toBeInTheDocument()
      expect(screen.getByText('Reviewing your application...')).toBeInTheDocument()
      
      // Check for animated spinner
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
    
    it('renders apply accepted status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="apply" status="accepted" locale="en" />
      )
      
      expect(screen.getByText('Application Accepted!')).toBeInTheDocument()
      expect(screen.getByText('Congratulations! Your application has been accepted.')).toBeInTheDocument()
    })
    
    it('renders apply pending documents status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="apply" status="pending_documents" locale="en" />
      )
      
      expect(screen.getByText('Documents Required')).toBeInTheDocument()
      expect(screen.getByText('Please upload the requested documents to complete your application.')).toBeInTheDocument()
      expect(screen.getByText('Upload Documents')).toBeInTheDocument()
    })
  })

  describe('Submit Status Pages', () => {
    it('renders submit received status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="submit" status="received" locale="en" />
      )
      
      expect(screen.getByText('Submission Received')).toBeInTheDocument()
      expect(screen.getByText('Your submission has been received and logged in our system.')).toBeInTheDocument()
    })
    
    it('renders submit processing status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="submit" status="processing" locale="en" />
      )
      
      expect(screen.getByText('Processing Submission')).toBeInTheDocument()
      expect(screen.getByText('Your submission is currently being processed.')).toBeInTheDocument()
    })
    
    it('renders submit requires changes status', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="submit" 
          status="requires_changes" 
          locale="en" 
          reason="Please provide additional details"
        />
      )
      
      expect(screen.getByText('Changes Required')).toBeInTheDocument()
      expect(screen.getByText('Changes Required')).toBeInTheDocument()
      expect(screen.getByText('Please provide additional details')).toBeInTheDocument()
      expect(screen.getByText('Make Changes')).toBeInTheDocument()
    })
  })

  describe('Approve Status Pages', () => {
    it('renders approve pending status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="approve" status="pending" locale="en" />
      )
      
      expect(screen.getByText('Approval Pending')).toBeInTheDocument()
      expect(screen.getByText('Your opportunity is pending administrative approval.')).toBeInTheDocument()
    })
    
    it('renders approve approved status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="approve" status="approved" locale="en" />
      )
      
      expect(screen.getByText('Opportunity Approved!')).toBeInTheDocument()
      expect(screen.getByText('Your opportunity has been approved.')).toBeInTheDocument()
    })
  })

  describe('Publish Status Pages', () => {
    it('renders publish scheduled status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="publish" status="scheduled" locale="en" />
      )
      
      expect(screen.getByText('Publication Scheduled')).toBeInTheDocument()
      expect(screen.getByText('View Scheduled')).toBeInTheDocument()
    })
    
    it('renders publish published status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="publish" status="published" locale="en" />
      )
      
      expect(screen.getByText('Opportunity Published!')).toBeInTheDocument()
      expect(screen.getByText('Your opportunity is now live and visible to all platform users.')).toBeInTheDocument()
    })
  })

  describe('Opportunity Information Display', () => {
    it('displays opportunity title when provided', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="create" 
          status="published" 
          locale="en" 
          opportunityTitle="Senior Developer Position"
        />
      )
      
      expect(screen.getByText('Opportunity Title')).toBeInTheDocument()
      expect(screen.getByText('Senior Developer Position')).toBeInTheDocument()
    })
    
    it('displays application ID when provided', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="apply" 
          status="submitted" 
          locale="en" 
          applicationId="APP-12345"
        />
      )
      
      expect(screen.getByText('Application ID')).toBeInTheDocument()
      expect(screen.getByText('APP-12345')).toBeInTheDocument()
    })
    
    it('displays submission ID when provided', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="submit" 
          status="received" 
          locale="en" 
          submissionId="SUB-67890"
        />
      )
      
      expect(screen.getByText('Submission ID')).toBeInTheDocument()
      expect(screen.getByText('SUB-67890')).toBeInTheDocument()
    })
    
    it('displays next step information when provided', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="apply" 
          status="accepted" 
          locale="en" 
          nextStep="Schedule interview within 5 business days"
        />
      )
      
      expect(screen.getByText('Next Step')).toBeInTheDocument()
      expect(screen.getByText('Schedule interview within 5 business days')).toBeInTheDocument()
    })
  })

  describe('Internationalization', () => {
    it('renders correctly in Ukrainian', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="draft" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Чернетку можливості збережено')).toBeInTheDocument()
      expect(screen.getByText('Вашу можливість збережено як чернетку.')).toBeInTheDocument()
    })
    
    it('renders apply status correctly in Ukrainian', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="apply" status="under_review" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Заявка на розгляді')).toBeInTheDocument()
      expect(screen.getByText('Розгляд вашої заявки...')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('generates correct navigation links for draft status', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="draft" locale="en" />
      )
      
      const editingLink = screen.getByRole('link', { name: 'Continue Editing' })
      expect(editingLink).toHaveAttribute('href', '/en/opportunities/add')
      
      const opportunitiesLink = screen.getByRole('link', { name: 'Back to Opportunities' })
      expect(opportunitiesLink).toHaveAttribute('href', '/en/opportunities')
    })
    
    it('renders help link', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="draft" locale="en" />
      )
      
      const helpLink = screen.getByRole('link', { name: 'Need help? Contact our support team' })
      expect(helpLink).toHaveAttribute('href', '/en/contact')
    })
  })

  describe('Icons and Visual Elements', () => {
    it('renders appropriate icons for different statuses', () => {
      const { container: publishedContainer } = renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" />
      )
      // Check if success icon is rendered
      expect(publishedContainer.querySelector('svg')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <OpportunityStatusPage action="create" status="failed" locale="en" />
      )
      expect(failedContainer.querySelector('svg')).toBeInTheDocument()
    })
    
    it('applies correct color themes for different statuses', () => {
      const { container: publishedContainer } = renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" />
      )
      
      // Check for success styling (green theme)
      expect(publishedContainer.querySelector('.bg-green-50')).toBeInTheDocument()
      expect(publishedContainer.querySelector('.text-green-500')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <OpportunityStatusPage action="create" status="failed" locale="en" />
      )
      
      // Check for error styling (red theme)
      expect(failedContainer.querySelector('.bg-red-50')).toBeInTheDocument()
      expect(failedContainer.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Action-Specific Behaviors', () => {
    it('shows different actions for different statuses', () => {
      // Draft status shows continue editing
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="draft" locale="en" />
      )
      expect(screen.getByText('Continue Editing')).toBeInTheDocument()
      
      // Published status shows view opportunity
      const { rerender } = renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" opportunityId="123" />
      )
      expect(screen.getByText('View Opportunity')).toBeInTheDocument()
      
      // Apply rejected shows apply again
      rerender(
        <NextIntlClientProvider messages={mockTranslations.en} locale="en">
          <OpportunityStatusPage action="apply" status="rejected" locale="en" opportunityId="123" />
        </NextIntlClientProvider>
      )
      expect(screen.getByText('Apply Again')).toBeInTheDocument()
    })
  })

  describe('Return URL Handling', () => {
    it('uses return URL when provided for published status', () => {
      renderWithTranslations(
        <OpportunityStatusPage 
          action="create" 
          status="published" 
          locale="en" 
          returnTo="/dashboard" 
        />
      )
      
      const backLink = screen.getByRole('link', { name: 'Back to Opportunities' })
      expect(backLink).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" />
      )
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Opportunity Published!')
    })
    
    it('has accessible button and link roles', () => {
      renderWithTranslations(
        <OpportunityStatusPage action="create" status="published" locale="en" />
      )
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
    })
  })
})
