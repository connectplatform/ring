import type { Connector } from 'wagmi'

/**
 * Returns true when any EIP-1193 injected provider is available in the current browser context.
 * Safe to call on the client only (returns false during SSR).
 */
export function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined'
}

/**
 * Builds a MetaMask in-app browser deep link for the current page.
 * On mobile web without injected provider, this opens MetaMask and re-loads the dapp inside it.
 */
export function getMetaMaskDappDeepLink(
  path: string = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
): string {
  const host = typeof window !== 'undefined' ? window.location.host : 'ring-platform.org'
  return `https://metamask.app.link/dapp/${host}${path}`
}

const CONNECTOR_SORT_ORDER: Record<string, number> = {
  walletConnect: 0,
  injected: 1,
  metamask: 2,
  metaMask: 2,
  coinbaseWallet: 3,
  coinbase: 3,
}

/**
 * Sorts connector list for best UX on the target device:
 * - Mobile: WalletConnect first (broadest wallet support without extension)
 * - Desktop: EIP-6963 injected first (installed extension)
 */
export function sortConnectorsForDevice(connectors: Connector[], isMobile: boolean): Connector[] {
  const copy = [...connectors]
  if (isMobile) {
    return copy.sort((a, b) => {
      const aOrder = CONNECTOR_SORT_ORDER[a.id] ?? 99
      const bOrder = CONNECTOR_SORT_ORDER[b.id] ?? 99
      return aOrder - bOrder
    })
  }
  return copy.sort((a, b) => {
    const aOrder = CONNECTOR_SORT_ORDER[a.id] ?? 99
    const bOrder = CONNECTOR_SORT_ORDER[b.id] ?? 99
    return bOrder - aOrder
  })
}

export interface ConnectorDisplayInfo {
  label: string
  icon?: string
}

const CONNECTOR_LABELS: Record<string, string> = {
  injected: 'Browser Wallet',
  metamask: 'MetaMask',
  metaMask: 'MetaMask',
  walletConnect: 'WalletConnect',
  walletconnect: 'WalletConnect',
  coinbaseWallet: 'Coinbase Wallet',
  coinbase: 'Coinbase Wallet',
}

/** Returns a human-readable display label for a connector. */
export function getConnectorDisplayInfo(connector: Connector): ConnectorDisplayInfo {
  const label = CONNECTOR_LABELS[connector.id] ?? connector.name ?? connector.id
  return { label }
}

/**
 * Normalises connector.icon for safe use as an <img src>.
 * EIP-6963 wallets supply data URIs; WalletConnect supplies remote URLs.
 * Returns null if the value is unusable.
 */
export function normalizeConnectorIconSrc(icon: string | undefined): string | null {
  if (!icon) return null
  if (icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon
  }
  return null
}
