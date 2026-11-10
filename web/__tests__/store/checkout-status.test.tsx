/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import CheckoutStatusPage from '@/components/store/checkout-status-page'
import type { Locale } from '@/i18n/shared'

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock ROUTES constants
jest.mock('@/constants/routes', () => ({
  ROUTES: {
    STORE: (locale: string) => `/${locale}/store`,
    CART: (locale: string) => `/${locale}/store/cart`,
    CONTACT: (locale: string) => `/${locale}/contact`,
    STORE_ORDERS: (locale: string) => `/${locale}/store/orders`,
    STORE_ORDER_DETAILS: (locale: string, id: string) => `/${locale}/store/orders/${id}`,
  }
}))

// Mock translations
const mockTranslations = {
  en: {
    'modules.store.checkout.status': {
      orderId: 'Order ID',
      needHelp: 'Need help? Contact our support team',
      success: {
        title: 'Payment Successful!',
        description: 'Your order has been successfully placed and payment confirmed.',
      },
      failure: {
        title: 'Payment Failed',
        description: 'Unfortunately, your payment could not be processed.',
      },
      cancel: {
        title: 'Order Cancelled',
        description: 'Your order has been cancelled.',
      },
      error: {
        title: 'An Error Occurred',
        description: 'We encountered an unexpected error.',
      },
      pending: {
        title: 'Payment Pending',
        description: 'Your payment is being processed.',
        waitMessage: 'Processing your payment...',
      },
      processing: {
        title: 'Processing Order',
        description: "We're currently processing your order.",
        timeEstimate: 'Estimated completion: 2-5 minutes',
      },
      complete: {
        title: 'Order Complete!',
        description: 'Your order has been completed successfully.',
      },
      actions: {
        viewOrder: 'View Order Details',
        tryAgain: 'Try Again',
        checkStatus: 'Check Order Status',
      },
    },
    common: {},
    'modules.store.cart': {
      continueShopping: 'Continue Shopping',
      backToCart: 'Back to cart',
    }
  },
  uk: {
    'modules.store.checkout.status': {
      orderId: 'Номер замовлення',
      needHelp: "Потрібна допомога? Зв'яжіться з нашою службою підтримки",
      success: {
        title: 'Оплата успішна!',
        description: 'Ваше замовлення успішно оформлено і оплату підтверджено.',
      },
      failure: {
        title: 'Помилка оплати',
        description: 'На жаль, ваш платіж не вдалося обробити.',
      },
      cancel: {
        title: 'Замовлення скасовано',
        description: 'Ваше замовлення було скасовано.',
      },
      error: {
        title: 'Виникла помилка',
        description: 'Ми зіткнулися з неочікуваною помилкою.',
      },
      pending: {
        title: 'Очікування оплати',
        description: 'Ваш платіж обробляється.',
        waitMessage: 'Обробка вашого платежу...',
      },
      processing: {
        title: 'Обробка замовлення',
        description: 'Зараз ми обробляємо ваше замовлення.',
        timeEstimate: 'Очікуваний час завершення: 2-5 хвилин',
      },
      complete: {
        title: 'Замовлення завершено!',
        description: 'Ваше замовлення успішно завершено.',
      },
      actions: {
        viewOrder: 'Переглянути деталі замовлення',
        tryAgain: 'Спробувати ще раз',
        checkStatus: 'Перевірити статус замовлення',
      },
    },
    common: {},
    'modules.store.cart': {
      continueShopping: 'Продовжити покупки',
      backToCart: 'Назад до кошика',
    }
  }
}

// Helper function to render component with translations
const renderWithTranslations = (component: React.ReactElement, locale: Locale = 'en') => {
  const raw = mockTranslations[locale]
  const messages = {
    modules: {
      store: {
        checkout: { status: raw['modules.store.checkout.status'] },
        cart: raw['modules.store.cart'],
      },
    },
  }

  return render(
    <NextIntlClientProvider messages={messages} locale={locale}>
      {component}
    </NextIntlClientProvider>
  )
}

describe('CheckoutStatusPage', () => {
  describe('Success Status', () => {
    it('renders success status correctly in English', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument()
      expect(screen.getByText('Your order has been successfully placed and payment confirmed.')).toBeInTheDocument()
      expect(screen.getByText('View Order Details')).toBeInTheDocument()
      expect(screen.getByText('Continue Shopping')).toBeInTheDocument()
    })
    
    it('renders success status correctly in Ukrainian', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="uk" />,
        'uk'
      )
      
      expect(screen.getByText('Оплата успішна!')).toBeInTheDocument()
      expect(screen.getByText('Ваше замовлення успішно оформлено і оплату підтверджено.')).toBeInTheDocument()
    })
    
    it('displays order ID when provided', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" orderId="ORD-12345" />
      )
      
      expect(screen.getByText('Order ID')).toBeInTheDocument()
      expect(screen.getByText('ORD-12345')).toBeInTheDocument()
    })
  })

  describe('Failure Status', () => {
    it('renders failure status with try again button', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="failure" locale="en" />
      )
      
      expect(screen.getByText('Payment Failed')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })

  describe('Error Status', () => {
    it('renders error status correctly', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="error" locale="en" />
      )
      
      expect(screen.getByText('An Error Occurred')).toBeInTheDocument()
      expect(screen.getByText('We encountered an unexpected error.')).toBeInTheDocument()
    })
  })

  describe('Cancel Status', () => {
    it('renders cancel status with back to cart button', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="cancel" locale="en" />
      )
      
      expect(screen.getByText('Order Cancelled')).toBeInTheDocument()
      expect(screen.getByText('Back to cart')).toBeInTheDocument()
    })
  })

  describe('Pending Status', () => {
    it('renders pending status with processing message', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="pending" locale="en" />
      )
      
      expect(screen.getByText('Payment Pending')).toBeInTheDocument()
      expect(screen.getByText('Processing your payment...')).toBeInTheDocument()
    })
    
    it('shows check status button when order ID is provided', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="pending" locale="en" orderId="ORD-12345" />
      )
      
      expect(screen.getByText('Check Order Status')).toBeInTheDocument()
    })
  })

  describe('Processing Status', () => {
    it('renders processing status with time estimate', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="processing" locale="en" />
      )
      
      expect(screen.getByText('Processing Order')).toBeInTheDocument()
      expect(screen.getByText('Estimated completion: 2-5 minutes')).toBeInTheDocument()
    })
  })

  describe('Complete Status', () => {
    it('renders complete status correctly', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="complete" locale="en" />
      )
      
      expect(screen.getByText('Order Complete!')).toBeInTheDocument()
      expect(screen.getByText('View Order Details')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('renders correct navigation links for each status', () => {
      // Test success status navigation
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      const storeLink = screen.getByRole('link', { name: 'Continue Shopping' })
      expect(storeLink).toHaveAttribute('href', '/en/store')
      
      const orderLink = screen.getByRole('link', { name: 'View Order Details' })
      expect(orderLink).toHaveAttribute('href', '/en/store/orders')
    })
    
    it('renders help link', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      const helpLink = screen.getByRole('link', { name: 'Need help? Contact our support team' })
      expect(helpLink).toHaveAttribute('href', '/en/contact')
    })
  })

  describe('Icons', () => {
    it('renders correct icons for each status', () => {
      const { container: successContainer } = renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      // Check if success icon (CheckCircle) is rendered
      expect(successContainer.querySelector('svg')).toBeInTheDocument()
      
      // Re-render with failure status
      const { container: failureContainer } = renderWithTranslations(
        <CheckoutStatusPage status="failure" locale="en" />
      )
      expect(failureContainer.querySelector('svg')).toBeInTheDocument()
    })
    
    it('has animated spinner icon for processing status', () => {
      const { container } = renderWithTranslations(
        <CheckoutStatusPage status="processing" locale="en" />
      )
      
      // Processing status should have animated spinner
      const spinnerIcon = container.querySelector('.animate-spin')
      expect(spinnerIcon).toBeInTheDocument()
    })
  })

  describe('Styling and Layout', () => {
    it('applies correct color themes for different statuses', () => {
      const { container: successContainer } = renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      expect(successContainer.querySelector('.text-emerald-500')).toBeInTheDocument()
      
      // Re-render with error status
      const { container: errorContainer } = renderWithTranslations(
        <CheckoutStatusPage status="error" locale="en" />
      )
      
      expect(errorContainer.querySelector('.text-red-500')).toBeInTheDocument()
    })
    
    it('renders responsive layout', () => {
      const { container } = renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      // Check for responsive classes
      expect(container.querySelector('.w-full')).toBeInTheDocument()
      expect(container.querySelector('.max-w-xl')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Payment Successful!')
    })
    
    it('has accessible button and link roles', () => {
      renderWithTranslations(
        <CheckoutStatusPage status="success" locale="en" />
      )
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      links.forEach(link => {
        expect(link).toHaveAttribute('href')
      })
    })
  })
})
