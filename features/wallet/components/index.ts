export { default as SendTokens } from '@/features/wallet/components/send-tokens'
export { default as WalletContactWidget } from '@/features/wallet/components/wallet-contact-widget'
export { default as RingOrderWidget } from '@/features/wallet/components/ring-order-widget'
export { default as WalletTransactionFeed } from '@/features/wallet/components/wallet-transaction-feed'
// WalletConnectPopup: deleted 2026-07-19 (dead stub; Wagmi Web3ScopeProvider is SSOT).
// WalletSection + ProfileAccountTokenWidgets: deprecated orphans (profile wallet tab).
// Superseded by WalletBalanceHero on /wallet — see wallet-client.tsx header comments.
// Kept as files for forensic/reapply; not re-exported from this barrel.
