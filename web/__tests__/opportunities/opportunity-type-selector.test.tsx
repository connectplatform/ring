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

jest.mock('@/components/ui/fs-modal', () => ({
  FsModal: ({
    children,
    title,
    open,
    layout,
  }: {
    children: React.ReactNode
    title: string
    open: boolean
    layout?: string
  }) =>
    open ? (
      <div data-testid="add-opportunity-fs-modal" data-layout={layout} data-title={title}>
        {children}
      </div>
    ) : null,
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
import { AddOpportunityFsModal } from '@/components/opportunities/add-opportunity-fs-modal'
import { requestOpportunityTypeSelector } from '@/lib/opportunities/request-opportunity-type-selector'
import { eventBus } from '@/lib/event-bus.client'
import { hideEmpireAsideGroups } from '@/lib/navigation/empire-aside'

describe('opportunity type selector', () => {
  it('exposes community request and offer selector types', () => {
    expect(OPPORTUNITY_SELECTOR_TYPE_ORDER).toEqual([
      'request',
      'offer',
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

  it('does not wrap overlay layout in RingCenterPaneOverlay', () => {
    render(
      <OpportunityTypeSelectorClient
        layout="overlay"
        userRole="member"
        onClose={jest.fn()}
      />,
    )
    expect(screen.queryByTestId('center-overlay')).toBeNull()
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  it('omits inner header and close when layout is body', () => {
    const { container } = render(
      <OpportunityTypeSelectorClient layout="body" userRole="member" onClose={jest.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
    const grid = container.querySelector('.grid-cols-1')
    expect(grid).toBeTruthy()
    expect(grid?.className).toMatch(/md:grid-cols-2/)
    expect(grid?.children.length).toBe(2)
  })

  it('renders request and offer selector tiles', () => {
    const { container } = render(
      <OpportunityTypeSelectorClient layout="embedded" userRole="subscriber" />,
    )
    const grid = container.querySelector('.grid-cols-1')
    expect(grid).toBeTruthy()
    expect(grid?.className).toMatch(/md:grid-cols-2/)
    expect(grid?.children.length).toBe(2)
  })

  it('hosts body selector in shared centerPane FsModal', () => {
    render(
      <AddOpportunityFsModal
        open
        onOpenChange={jest.fn()}
        userRole="member"
        locale={'en' as never}
      />,
    )
    const host = screen.getByTestId('add-opportunity-fs-modal')
    expect(host.getAttribute('data-layout')).toBe('centerPane')
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  it('emits type-selector request on every viewport', () => {
    ;(eventBus.emit as jest.Mock).mockClear()
    expect(requestOpportunityTypeSelector()).toBe(true)
    expect(eventBus.emit).toHaveBeenCalledWith('opportunity:open-type-selector', {})
  })
})

describe('hideEmpireAsideGroups', () => {
  it('hides empire concept and get-started groups when a pack is set', () => {
    expect(hideEmpireAsideGroups('mvm-agricultural')).toBe(true)
    expect(hideEmpireAsideGroups('news-station')).toBe(true)
    expect(hideEmpireAsideGroups('evolvement')).toBe(true)
  })

  it('keeps empire groups when pack is absent', () => {
    expect(hideEmpireAsideGroups(null)).toBe(false)
    expect(hideEmpireAsideGroups('')).toBe(false)
    expect(hideEmpireAsideGroups('   ')).toBe(false)
  })
})
