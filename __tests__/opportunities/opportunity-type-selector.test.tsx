/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  OPPORTUNITY_SELECTOR_TYPE_ORDER,
} from '@/features/opportunities/lib/opportunity-type-presets'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

jest.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/en/opportunities',
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('@/lib/event-bus.client', () => ({
  eventBus: {
    on: () => () => {},
    emit: jest.fn(),
  },
}))

jest.mock('@/components/layout/ring-center-pane-overlay', () => ({
  RingCenterPaneOverlay: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
  }) => (open ? <div data-testid="center-overlay">{children}</div> : null),
}))

jest.mock('@/hooks/use-vendor-status', () => ({
  useVendorStatus: () => ({ hasVendor: false }),
}))

jest.mock('@/components/membership/upgrade-modal', () => ({
  MembershipUpgradeModal: () => <div data-testid="upgrade-modal" />,
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import { OpportunityTypeSelector } from '@/components/opportunities/opportunity-type-selector'

describe('opportunity type selector', () => {
  it('exposes exactly four persona selector types', () => {
    expect(OPPORTUNITY_SELECTOR_TYPE_ORDER).toEqual([
      'project_order',
      'cv',
      'vendor_listing',
      'program',
    ])
  })

  it('forwards onClose from OpportunityTypeSelector passthrough', () => {
    const onClose = jest.fn()
    render(
      <OpportunityTypeSelector
        layout="embedded"
        userRole={'subscriber' as never}
        onClose={onClose}
      />,
    )
    const closeBtn = screen.getByRole('button', { name: /close/i })
    closeBtn.click()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders mobile-sheet shell with bottom-nav clearance class', () => {
    const { container } = render(
      <OpportunityTypeSelectorClient
        layout="mobile-sheet"
        userRole="member"
        onClose={jest.fn()}
      />,
    )
    const sheet = container.querySelector('#opportunity-type-selector-mobile')
    expect(sheet).toBeTruthy()
    expect(sheet?.className).toMatch(/z-\[8990\]/)
    expect(sheet?.className).toMatch(/mobile-bottom-nav-h/)
  })

  it('renders overlay via RingCenterPaneOverlay', () => {
    render(
      <OpportunityTypeSelectorClient
        layout="overlay"
        userRole="member"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByTestId('center-overlay')).toBeTruthy()
  })

  it('fills a 2×2 grid for all four types', () => {
    const { container } = render(
      <OpportunityTypeSelectorClient layout="embedded" userRole="subscriber" />,
    )
    const grid = container.querySelector('.grid-cols-2.grid-rows-2')
    expect(grid).toBeTruthy()
    expect(grid?.children.length).toBe(4)
  })
})
