/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import AuthStatusPage from '../../components/auth/AuthStatusPage'
import type { Locale } from '../../i18n-config'
import  {  describe,  it,  expect,  jest, beforeEach,  afterEach  }  from  '@jest/globals'
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
    HOME: (locale: string) => `/${locale}`,
    LOGIN: (locale: string) => `/${locale}/login`,
    PROFILE: (locale: string) => `/${locale}/profile`,
    CONTACT: (locale: string) => `/${locale}/contact`,
    FORGOT_PASSWORD: (locale: string) => `/${locale}/forgot-password`,
  }
}))

// Mock translations
const mockTranslations = {
  en: {
    'modules.auth.status': {
      'email': 'Email',
      'requestId': 'Request ID',
      'needHelp': 'Need help? Contact our support team',
      'checkEmailInstruction': 'Check your email and click the verification link to continue.',
      'actions.continue': 'Continue',
      'actions.backToHome': 'Back to Home',
      'actions.tryAgain': 'Try Again',
      'actions.backToLogin': 'Back to Login',
      'actions.viewProfile': 'View Profile',
      'actions.contactSupport': 'Contact Support',
      'actions.proceedToLogin': 'Proceed to Login',
      'actions.startKyc': 'Start Verification',
      
      // Login statuses
      'login.success.title': 'Login Successful!',
      'login.success.description': 'You have been successfully logged in. Welcome back!',
      'login.failed.title': 'Login Failed',
      'login.failed.description': 'We couldn\'t sign you in. Please check your credentials and try again.',
      'login.blocked.title': 'Account Blocked',
      'login.blocked.description': 'Your account has been temporarily blocked.',
      
      // Register statuses
      'register.success.title': 'Registration Successful!',
      'register.success.description': 'Your account has been created successfully.',
      'register.pending_verification.title': 'Verify Your Email',
      'register.pending_verification.description': 'We\'ve sent a verification link to your email address.',
      'register.pending_verification.instruction': 'Didn\'t receive the email? Check your spam folder.',
      'register.email_sent.title': 'Verification Email Sent',
      'register.email_sent.description': 'We\'ve sent a verification link to your email.',
      
      // Verify statuses
      'verify.success.title': 'Email Verified!',
      'verify.success.description': 'Your email address has been successfully verified.',
      'verify.failed.title': 'Verification Failed',
      'verify.failed.description': 'We couldn\'t verify your email address.',
      'verify.expired.title': 'Verification Link Expired',
      'verify.expired.description': 'The verification link has expired.',
      'verify.already_verified.title': 'Already Verified',
      'verify.already_verified.description': 'Your email address is already verified.',
      
      // Reset password statuses
      'reset-password.email_sent.title': 'Reset Email Sent',
      'reset-password.email_sent.description': 'We\'ve sent password reset instructions to your email.',
      'reset-password.success.title': 'Password Reset Successful!',
      'reset-password.success.description': 'Your password has been successfully changed.',
      'reset-password.failed.title': 'Reset Failed',
      'reset-password.failed.description': 'We couldn\'t reset your password.',
      'reset-password.expired.title': 'Reset Link Expired',
      'reset-password.expired.description': 'The password reset link has expired.',
      'reset-password.invalid_token.title': 'Invalid Reset Link',
      'reset-password.invalid_token.description': 'The password reset link is invalid.',
      
      // KYC statuses
      'kyc.not_started.title': 'Identity Verification Required',
      'kyc.not_started.description': 'Complete identity verification to access premium features.',
      'kyc.pending.title': 'Verification Submitted',
      'kyc.pending.description': 'Your identity verification has been submitted and is pending review.',
      'kyc.under_review.title': 'Under Review',
      'kyc.under_review.description': 'Our team is currently reviewing your identity verification documents.',
      'kyc.under_review.processing': 'Reviewing your documents...',
      'kyc.approved.title': 'Identity Verified!',
      'kyc.approved.description': 'Your identity has been successfully verified.',
      'kyc.rejected.title': 'Verification Rejected',
      'kyc.rejected.description': 'Your identity verification was not approved.',
      'kyc.expired.title': 'Verification Expired',
      'kyc.expired.description': 'Your identity verification has expired.'
    },
    'common': {}
  },
  uk: {
    'modules.auth.status': {
      'email': 'Електронна пошта',
      'requestId': 'ID запиту',
      'needHelp': 'Потрібна допомога? Зв\'яжіться з нашою службою підтримки',
      'checkEmailInstruction': 'Перевірте свою електронну пошту та натисніть на посилання для підтвердження.',
      'actions.continue': 'Продовжити',
      'actions.backToHome': 'На головну',
      'actions.tryAgain': 'Спробувати знову',
      'actions.backToLogin': 'Назад до входу',
      'actions.viewProfile': 'Переглянути профіль',
      'actions.contactSupport': 'Зв\'язатися з підтримкою',
      'actions.proceedToLogin': 'Перейти до входу',
      'actions.startKyc': 'Почати верифікацію',
      
      'login.success.title': 'Успішний вхід!',
      'login.success.description': 'Ви успішно увійшли до системи. Ласкаво просимо!',
      'register.pending_verification.title': 'Підтвердіть вашу пошту',
      'register.pending_verification.description': 'Ми надіслали посилання для підтвердження на вашу електронну адресу.',
      'kyc.under_review.title': 'На розгляді',
      'kyc.under_review.description': 'Наша команда зараз розглядає ваші документи для верифікації особи.',
      'kyc.under_review.processing': 'Розгляд ваших документів...'
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

describe('AuthStatusPage', () => {
  describe('Login Status Pages', () => {
    it('renders login success status correctly', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      expect(screen.getByText('Login Successful!')).toBeInTheDocument()
      expect(screen.getByText('You have been successfully logged in. Welcome back!')).toBeInTheDocument()
      expect(screen.getByText('Continue')).toBeInTheDocument()
      expect(screen.getByText('Back to Home')).toBeInTheDocument()
    })
    
    it('renders login failed status with try again option', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="failed" locale="en" />
      )
      
      expect(screen.getByText('Login Failed')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
    
    it('renders login blocked status with contact support', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="blocked" locale="en" />
      )
      
      expect(screen.getByText('Account Blocked')).toBeInTheDocument()
      expect(screen.getByText('Contact Support')).toBeInTheDocument()
    })
  })

  describe('Register Status Pages', () => {
    it('renders registration success status', () => {
      renderWithTranslations(
        <AuthStatusPage action="register" status="success" locale="en" />
      )
      
      expect(screen.getByText('Registration Successful!')).toBeInTheDocument()
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
    
    it('renders registration pending verification with email instruction', () => {
      renderWithTranslations(
        <AuthStatusPage action="register" status="pending_verification" locale="en" />
      )
      
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument()
      expect(screen.getByText('We\'ve sent a verification link to your email address.')).toBeInTheDocument()
      expect(screen.getByText('Didn\'t receive the email? Check your spam folder.')).toBeInTheDocument()
      expect(screen.getByText('Back to Login')).toBeInTheDocument()
    })
    
    it('renders email sent status', () => {
      renderWithTranslations(
        <AuthStatusPage action="register" status="email_sent" locale="en" />
      )
      
      expect(screen.getByText('Verification Email Sent')).toBeInTheDocument()
      expect(screen.getByText('Check your email and click the verification link to continue.')).toBeInTheDocument()
    })
  })

  describe('Email Verification Status Pages', () => {
    it('renders email verification success', () => {
      renderWithTranslations(
        <AuthStatusPage action="verify" status="success" locale="en" />
      )
      
      expect(screen.getByText('Email Verified!')).toBeInTheDocument()
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
    
    it('renders verification failed status', () => {
      renderWithTranslations(
        <AuthStatusPage action="verify" status="failed" locale="en" />
      )
      
      expect(screen.getByText('Verification Failed')).toBeInTheDocument()
    })
    
    it('renders already verified status', () => {
      renderWithTranslations(
        <AuthStatusPage action="verify" status="already_verified" locale="en" />
      )
      
      expect(screen.getByText('Already Verified')).toBeInTheDocument()
      expect(screen.getByText('Proceed to Login')).toBeInTheDocument()
    })
  })

  describe('Password Reset Status Pages', () => {
    it('renders password reset email sent', () => {
      renderWithTranslations(
        <AuthStatusPage action="reset-password" status="email_sent" locale="en" />
      )
      
      expect(screen.getByText('Reset Email Sent')).toBeInTheDocument()
      expect(screen.getByText('Check your email and click the verification link to continue.')).toBeInTheDocument()
    })
    
    it('renders password reset success', () => {
      renderWithTranslations(
        <AuthStatusPage action="reset-password" status="success" locale="en" />
      )
      
      expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument()
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
  })

  describe('KYC Status Pages', () => {
    it('renders KYC not started status', () => {
      renderWithTranslations(
        <AuthStatusPage action="kyc" status="not_started" locale="en" />
      )
      
      expect(screen.getByText('Identity Verification Required')).toBeInTheDocument()
      expect(screen.getByText('Start Verification')).toBeInTheDocument()
    })
    
    it('renders KYC under review with animated spinner', () => {
      const { container } = renderWithTranslations(
        <AuthStatusPage action="kyc" status="under_review" locale="en" />
      )
      
      expect(screen.getByText('Under Review')).toBeInTheDocument()
      expect(screen.getByText('Reviewing your documents...')).toBeInTheDocument()
      
      // Check for animated spinner
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
    
    it('renders KYC approved status', () => {
      renderWithTranslations(
        <AuthStatusPage action="kyc" status="approved" locale="en" />
      )
      
      expect(screen.getByText('Identity Verified!')).toBeInTheDocument()
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
    
    it('renders KYC rejected status with revision option', () => {
      renderWithTranslations(
        <AuthStatusPage action="kyc" status="rejected" locale="en" />
      )
      
      expect(screen.getByText('Verification Rejected')).toBeInTheDocument()
      expect(screen.getByText('Contact Support')).toBeInTheDocument()
    })
  })

  describe('Email and Request ID Display', () => {
    it('displays email when provided', () => {
      renderWithTranslations(
        <AuthStatusPage 
          action="register" 
          status="pending_verification" 
          locale="en" 
          email="user@example.com"
        />
      )
      
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('user@example.com')).toBeInTheDocument()
    })
    
    it('displays request ID when provided for KYC', () => {
      renderWithTranslations(
        <AuthStatusPage 
          action="kyc" 
          status="pending" 
          locale="en" 
          requestId="KYC-12345"
        />
      )
      
      expect(screen.getByText('Request ID')).toBeInTheDocument()
      expect(screen.getByText('KYC-12345')).toBeInTheDocument()
    })
  })

  describe('Internationalization', () => {
    it('renders correctly in Ukrainian', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Успішний вхід!')).toBeInTheDocument()
      expect(screen.getByText('Ви успішно увійшли до системи. Ласкаво просимо!')).toBeInTheDocument()
    })
    
    it('renders KYC status correctly in Ukrainian', () => {
      renderWithTranslations(
        <AuthStatusPage action="kyc" status="under_review" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('На розгляді')).toBeInTheDocument()
      expect(screen.getByText('Розгляд ваших документів...')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('generates correct navigation links', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      const continueLink = screen.getByRole('link', { name: 'Continue' })
      expect(continueLink).toHaveAttribute('href', '/en/profile')
      
      const homeLink = screen.getByRole('link', { name: 'Back to Home' })
      expect(homeLink).toHaveAttribute('href', '/en')
    })
    
    it('renders help link', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      const helpLink = screen.getByRole('link', { name: 'Need help? Contact our support team' })
      expect(helpLink).toHaveAttribute('href', '/en/contact')
    })
  })

  describe('Icons and Visual Elements', () => {
    it('renders appropriate icons for different statuses', () => {
      const { container: successContainer } = renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      // Check if success icon is rendered
      expect(successContainer.querySelector('svg')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <AuthStatusPage action="login" status="failed" locale="en" />
      )
      expect(failedContainer.querySelector('svg')).toBeInTheDocument()
    })
    
    it('applies correct color themes for different statuses', () => {
      const { container: successContainer } = renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      // Check for success styling (green theme)
      expect(successContainer.querySelector('.bg-green-50')).toBeInTheDocument()
      expect(successContainer.querySelector('.text-green-500')).toBeInTheDocument()
      
      // Re-render with failed status
      const { container: failedContainer } = renderWithTranslations(
        <AuthStatusPage action="login" status="failed" locale="en" />
      )
      
      // Check for error styling (red theme)
      expect(failedContainer.querySelector('.bg-red-50')).toBeInTheDocument()
      expect(failedContainer.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Return URL Handling', () => {
    it('uses return URL when provided for success states', () => {
      renderWithTranslations(
        <AuthStatusPage 
          action="login" 
          status="success" 
          locale="en" 
          returnTo="/dashboard" 
        />
      )
      
      const continueLink = screen.getByRole('link', { name: 'Continue' })
      expect(continueLink).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Login Successful!')
    })
    
    it('has accessible button and link roles', () => {
      renderWithTranslations(
        <AuthStatusPage action="login" status="success" locale="en" />
      )
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
    })
  })
})
