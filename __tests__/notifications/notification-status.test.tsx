/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import NotificationStatusPage from '../../components/notifications/NotificationStatusPage'
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
    NOTIFICATIONS: (locale: string) => `/${locale}/notifications`,
    HOME: (locale: string) => `/${locale}`,
    HELP: (locale: string) => `/${locale}/help`,
    CONTACT: (locale: string) => `/${locale}/contact`,
  }
}))

// Mock translations
const mockTranslations = {
  en: {
    'modules.notifications.status': {
      'topic': 'Topic',
      'notificationId': 'Notification ID',
      'subscriptionId': 'Subscription ID',
      'deviceRegistered': 'Device Registered',
      'failureReason': 'Failure Reason',
      'denialReason': 'Denial Reason',
      'cancellationReason': 'Cancellation Reason',
      'needHelp': 'Need help? Contact our support team',
      
      'actions.manageNotifications': 'Manage Notifications',
      'actions.manageSubscriptions': 'Manage Subscriptions',
      'actions.viewNotifications': 'View Notifications',
      'actions.viewAllNotifications': 'View All Notifications',
      'actions.backToApp': 'Back to App',
      'actions.retryPermission': 'Retry Permission',
      'actions.retrySubscription': 'Retry Subscription',
      'actions.retrySending': 'Retry Sending',
      'actions.resubscribe': 'Resubscribe',
      'actions.getHelp': 'Get Help',
      'actions.viewSupportedBrowsers': 'View Supported Browsers',
      'actions.checkSettings': 'Check Settings',
      'actions.checkStatus': 'Check Status',
      'actions.contactSupport': 'Contact Support',
      
      // Permission statuses
      'permission.granted.title': 'Notifications Enabled!',
      'permission.granted.description': 'You will now receive push notifications from Ring Platform.',
      'permission.denied.title': 'Notifications Blocked',
      'permission.denied.description': 'Push notifications have been blocked for this site.',
      'permission.pending.title': 'Permission Required',
      'permission.pending.description': 'Please allow notifications to receive important updates.',
      'permission.pending.waiting': 'Waiting for your permission...',
      'permission.unsupported.title': 'Notifications Not Supported',
      'permission.unsupported.description': 'Your browser or device doesn\'t support push notifications.',
      'permission.unsupported.browserInfo': 'Supported browsers include Chrome, Firefox, Safari, and Edge.',
      
      // Subscribe statuses
      'subscribe.subscribed.title': 'Successfully Subscribed!',
      'subscribe.subscribed.description': 'You are now subscribed to notifications.',
      'subscribe.subscribed.activeSubscription': 'Your subscription is active and notifications are enabled.',
      'subscribe.unsubscribed.title': 'Subscription Cancelled',
      'subscribe.unsubscribed.description': 'You have been unsubscribed from notifications.',
      'subscribe.failed.title': 'Subscription Failed',
      'subscribe.failed.description': 'We couldn\'t subscribe you to notifications due to a technical issue.',
      'subscribe.pending.title': 'Subscription Processing',
      'subscribe.pending.description': 'Your subscription request is being processed.',
      
      // Send statuses
      'send.sent.title': 'Notification Sent',
      'send.sent.description': 'Your notification has been successfully sent.',
      'send.delivered.title': 'Notification Delivered!',
      'send.delivered.description': 'Your notification has been delivered.',
      'send.delivered.deliveryConfirmed': 'Delivery confirmed by the notification service.',
      'send.failed.title': 'Send Failed',
      'send.failed.description': 'We couldn\'t send your notification due to a technical issue.',
      'send.pending.title': 'Sending Notification',
      'send.pending.description': 'Your notification is being sent.',
      
      // Deliver statuses
      'deliver.delivered.title': 'Message Delivered',
      'deliver.delivered.description': 'Your message has been successfully delivered.',
      'deliver.delivered.deliveryConfirmed': 'The message was delivered to the recipient\'s device.',
      'deliver.read.title': 'Message Read',
      'deliver.read.description': 'Your message has been read by the recipient.',
      'deliver.failed.title': 'Delivery Failed',
      'deliver.failed.description': 'Your message couldn\'t be delivered.',
      'deliver.cancelled.title': 'Delivery Cancelled',
      'deliver.cancelled.description': 'Message delivery was cancelled before reaching the recipient.'
    },
    'common': {}
  },
  uk: {
    'modules.notifications.status': {
      'topic': 'Тема',
      'notificationId': 'ID сповіщення',
      'subscriptionId': 'ID підписки',
      'deviceRegistered': 'Пристрій зареєстровано',
      'needHelp': 'Потрібна допомога? Зв\'яжіться з нашою службою підтримки',
      
      'actions.manageNotifications': 'Керувати сповіщеннями',
      'actions.backToApp': 'Назад до додатку',
      'actions.retryPermission': 'Повторити дозвіл',
      
      'permission.granted.title': 'Сповіщення увімкнено!',
      'permission.granted.description': 'Тепер ви отримуватимете push-сповіщення від Ring Platform.',
      'subscribe.subscribed.title': 'Успішно підписано!',
      'subscribe.subscribed.description': 'Тепер ви підписані на сповіщення.',
      'subscribe.subscribed.activeSubscription': 'Ваша підписка активна і сповіщення увімкнено.'
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

describe('NotificationStatusPage', () => {
  describe('Permission Status Pages', () => {
    it('renders permission granted status correctly', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      expect(screen.getByText('Notifications Enabled!')).toBeInTheDocument()
      expect(screen.getByText('You will now receive push notifications from Ring Platform.')).toBeInTheDocument()
      expect(screen.getByText('Manage Notifications')).toBeInTheDocument()
      expect(screen.getByText('Back to App')).toBeInTheDocument()
    })
    
    it('renders permission denied status with retry option', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="permission" 
          status="denied" 
          locale="en" 
          reason="User manually blocked notifications"
        />
      )
      
      expect(screen.getByText('Notifications Blocked')).toBeInTheDocument()
      expect(screen.getByText('Push notifications have been blocked for this site.')).toBeInTheDocument()
      expect(screen.getByText('Retry Permission')).toBeInTheDocument()
      expect(screen.getByText('Get Help')).toBeInTheDocument()
    })
    
    it('renders permission pending status with animated spinner', () => {
      const { container } = renderWithTranslations(
        <NotificationStatusPage action="permission" status="pending" locale="en" />
      )
      
      expect(screen.getByText('Permission Required')).toBeInTheDocument()
      expect(screen.getByText('Waiting for your permission...')).toBeInTheDocument()
      
      // Check for animated spinner
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
    
    it('renders permission unsupported status with browser info', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="unsupported" locale="en" />
      )
      
      expect(screen.getByText('Notifications Not Supported')).toBeInTheDocument()
      expect(screen.getByText('Supported browsers include Chrome, Firefox, Safari, and Edge.')).toBeInTheDocument()
      expect(screen.getByText('View Supported Browsers')).toBeInTheDocument()
    })
  })

  describe('Subscribe Status Pages', () => {
    it('renders subscribe subscribed status with topic', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="subscribe" 
          status="subscribed" 
          locale="en" 
          topic="Product Updates"
        />
      )
      
      expect(screen.getByText('Successfully Subscribed!')).toBeInTheDocument()
      expect(screen.getByText('Topic')).toBeInTheDocument()
      expect(screen.getByText('Product Updates')).toBeInTheDocument()
      expect(screen.getByText('Your subscription is active and notifications are enabled.')).toBeInTheDocument()
    })
    
    it('renders subscribe unsubscribed status', () => {
      renderWithTranslations(
        <NotificationStatusPage action="subscribe" status="unsubscribed" locale="en" />
      )
      
      expect(screen.getByText('Subscription Cancelled')).toBeInTheDocument()
      expect(screen.getByText('Resubscribe')).toBeInTheDocument()
    })
    
    it('renders subscribe failed status with retry option', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="subscribe" 
          status="failed" 
          locale="en" 
          reason="Network connectivity issue"
        />
      )
      
      expect(screen.getByText('Subscription Failed')).toBeInTheDocument()
      expect(screen.getByText('Failure Reason')).toBeInTheDocument()
      expect(screen.getByText('Network connectivity issue')).toBeInTheDocument()
      expect(screen.getByText('Retry Subscription')).toBeInTheDocument()
    })
  })

  describe('Send Status Pages', () => {
    it('renders send sent status', () => {
      renderWithTranslations(
        <NotificationStatusPage action="send" status="sent" locale="en" />
      )
      
      expect(screen.getByText('Notification Sent')).toBeInTheDocument()
      expect(screen.getByText('Your notification has been successfully sent.')).toBeInTheDocument()
      expect(screen.getByText('View Notifications')).toBeInTheDocument()
    })
    
    it('renders send delivered status with confirmation', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="send" 
          status="delivered" 
          locale="en" 
          notificationId="NOTIF-12345"
        />
      )
      
      expect(screen.getByText('Notification Delivered!')).toBeInTheDocument()
      expect(screen.getByText('Notification ID')).toBeInTheDocument()
      expect(screen.getByText('NOTIF-12345')).toBeInTheDocument()
      expect(screen.getByText('Delivery confirmed by the notification service.')).toBeInTheDocument()
    })
    
    it('renders send failed status with retry option', () => {
      renderWithTranslations(
        <NotificationStatusPage action="send" status="failed" locale="en" />
      )
      
      expect(screen.getByText('Send Failed')).toBeInTheDocument()
      expect(screen.getByText('Retry Sending')).toBeInTheDocument()
      expect(screen.getByText('Contact Support')).toBeInTheDocument()
    })
  })

  describe('Deliver Status Pages', () => {
    it('renders deliver delivered status', () => {
      renderWithTranslations(
        <NotificationStatusPage action="deliver" status="delivered" locale="en" />
      )
      
      expect(screen.getByText('Message Delivered')).toBeInTheDocument()
      expect(screen.getByText('The message was delivered to the recipient\'s device.')).toBeInTheDocument()
    })
    
    it('renders deliver read status', () => {
      renderWithTranslations(
        <NotificationStatusPage action="deliver" status="read" locale="en" />
      )
      
      expect(screen.getByText('Message Read')).toBeInTheDocument()
      expect(screen.getByText('Your message has been read by the recipient.')).toBeInTheDocument()
    })
    
    it('renders deliver cancelled status with reason', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="deliver" 
          status="cancelled" 
          locale="en" 
          reason="User device was offline"
        />
      )
      
      expect(screen.getByText('Delivery Cancelled')).toBeInTheDocument()
      expect(screen.getByText('Cancellation Reason')).toBeInTheDocument()
      expect(screen.getByText('User device was offline')).toBeInTheDocument()
    })
  })

  describe('Additional Information Display', () => {
    it('displays subscription ID when provided', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="subscribe" 
          status="subscribed" 
          locale="en" 
          subscriptionId="SUB-67890"
        />
      )
      
      expect(screen.getByText('Subscription ID')).toBeInTheDocument()
      expect(screen.getByText('SUB-67890')).toBeInTheDocument()
    })
    
    it('displays masked device token for granted permissions', () => {
      const longToken = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz'
      renderWithTranslations(
        <NotificationStatusPage 
          action="permission" 
          status="granted" 
          locale="en" 
          deviceToken={longToken}
        />
      )
      
      expect(screen.getByText('Device Registered')).toBeInTheDocument()
      expect(screen.getByText('abcdefgh...vwxyz')).toBeInTheDocument()
    })
  })

  describe('Internationalization', () => {
    it('renders correctly in Ukrainian', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Сповіщення увімкнено!')).toBeInTheDocument()
      expect(screen.getByText('Тепер ви отримуватимете push-сповіщення від Ring Platform.')).toBeInTheDocument()
    })
    
    it('renders subscribe status correctly in Ukrainian', () => {
      renderWithTranslations(
        <NotificationStatusPage action="subscribe" status="subscribed" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Успішно підписано!')).toBeInTheDocument()
      expect(screen.getByText('Ваша підписка активна і сповіщення увімкнено.')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('generates correct navigation links for granted permissions', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      const manageLink = screen.getByRole('link', { name: 'Manage Notifications' })
      expect(manageLink).toHaveAttribute('href', '/en/notifications')
      
      const backLink = screen.getByRole('link', { name: 'Back to App' })
      expect(backLink).toHaveAttribute('href', '/en')
    })
    
    it('uses return URL when provided', () => {
      renderWithTranslations(
        <NotificationStatusPage 
          action="permission" 
          status="granted" 
          locale="en" 
          returnTo="/dashboard" 
        />
      )
      
      const backLink = screen.getByRole('link', { name: 'Back to App' })
      expect(backLink).toHaveAttribute('href', '/dashboard')
    })
    
    it('renders help link', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      const helpLink = screen.getByRole('link', { name: 'Need help? Contact our support team' })
      expect(helpLink).toHaveAttribute('href', '/en/contact')
    })
  })

  describe('Icons and Visual Elements', () => {
    it('renders appropriate icons for different statuses', () => {
      const { container: grantedContainer } = renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      // Check if success icon is rendered
      expect(grantedContainer.querySelector('svg')).toBeInTheDocument()
      
      // Re-render with denied status
      const { container: deniedContainer } = renderWithTranslations(
        <NotificationStatusPage action="permission" status="denied" locale="en" />
      )
      expect(deniedContainer.querySelector('svg')).toBeInTheDocument()
    })
    
    it('applies correct color themes for different statuses', () => {
      const { container: grantedContainer } = renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      // Check for success styling (green theme)
      expect(grantedContainer.querySelector('.bg-green-50')).toBeInTheDocument()
      expect(grantedContainer.querySelector('.text-green-500')).toBeInTheDocument()
      
      // Re-render with denied status
      const { container: deniedContainer } = renderWithTranslations(
        <NotificationStatusPage action="permission" status="denied" locale="en" />
      )
      
      // Check for error styling (red theme)
      expect(deniedContainer.querySelector('.bg-red-50')).toBeInTheDocument()
      expect(deniedContainer.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Interactive Elements', () => {
    it('has retry buttons for failed states', () => {
      renderWithTranslations(
        <NotificationStatusPage action="subscribe" status="failed" locale="en" />
      )
      
      const retryButton = screen.getByRole('button', { name: 'Retry Subscription' })
      expect(retryButton).toBeInTheDocument()
    })
    
    it('has check status button for pending states', () => {
      renderWithTranslations(
        <NotificationStatusPage action="subscribe" status="pending" locale="en" />
      )
      
      const checkButton = screen.getByRole('button', { name: 'Check Status' })
      expect(checkButton).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Notifications Enabled!')
    })
    
    it('has accessible button and link roles', () => {
      renderWithTranslations(
        <NotificationStatusPage action="permission" status="granted" locale="en" />
      )
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
    })
  })
})
