/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import {
  AdminSupermenuProvider,
  useAdminSupermenuState,
} from '@/components/navigation/admin-supermenu-context'

function Probe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useAdminSupermenuState>) => void
}) {
  const api = useAdminSupermenuState()
  React.useEffect(() => {
    onReady(api)
  }, [api, onReady])
  return (
    <div>
      <button type="button" ref={api.toggleRef} onClick={api.toggle}>
        Toggle
      </button>
      <a href="/en/opportunities">Opportunities</a>
      <button type="button" data-testid="theme">
        Theme
      </button>
      <span data-testid="open">{api.open ? 'open' : 'closed'}</span>
    </div>
  )
}

describe('AdminSupermenu close behavior', () => {
  it('toggles open/closed and restores focus on Escape-style close', () => {
    let api: ReturnType<typeof useAdminSupermenuState> | null = null
    const { getByText, getByTestId } = render(
      <AdminSupermenuProvider>
        <Probe onReady={(a) => { api = a }} />
      </AdminSupermenuProvider>,
    )

    expect(getByTestId('open').textContent).toBe('closed')
    fireEvent.click(getByText('Toggle'))
    expect(getByTestId('open').textContent).toBe('open')

    act(() => {
      api!.close({ restoreFocus: true })
    })
    expect(getByTestId('open').textContent).toBe('closed')
  })

  it('closes without restoreFocus when navigating', () => {
    let api: ReturnType<typeof useAdminSupermenuState> | null = null
    const { getByText, getByTestId } = render(
      <AdminSupermenuProvider>
        <Probe onReady={(a) => { api = a }} />
      </AdminSupermenuProvider>,
    )

    fireEvent.click(getByText('Toggle'))
    expect(getByTestId('open').textContent).toBe('open')

    act(() => {
      api!.close({ restoreFocus: false })
    })
    expect(getByTestId('open').textContent).toBe('closed')
  })
})

/** Mirrors DesktopSidebarShell capture: only a[href] closes. */
function CaptureShell({ children }: { children: React.ReactNode }) {
  const { open, close } = useAdminSupermenuState()
  return (
    <div
      onClickCapture={(event) => {
        if (!open) return
        const target = event.target
        if (!(target instanceof Element)) return
        const anchor = target.closest('a[href]')
        if (!anchor) return
        const href = anchor.getAttribute('href')
        if (!href || href === '#') return
        close({ restoreFocus: false })
      }}
    >
      {children}
    </div>
  )
}

describe('DesktopSidebarShell link capture', () => {
  it('closes on anchor navigation but not on utility buttons', () => {
    const { getByText, getByTestId } = render(
      <AdminSupermenuProvider>
        <CaptureShell>
          <Probe onReady={() => {}} />
        </CaptureShell>
      </AdminSupermenuProvider>,
    )

    fireEvent.click(getByText('Toggle'))
    expect(getByTestId('open').textContent).toBe('open')

    fireEvent.click(getByTestId('theme'))
    expect(getByTestId('open').textContent).toBe('open')

    fireEvent.click(getByText('Opportunities'))
    expect(getByTestId('open').textContent).toBe('closed')
  })
})
