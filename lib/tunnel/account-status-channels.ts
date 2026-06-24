/** Per-user tunnel channel for account status push (suspend / reactivate). */
export const ACCOUNT_STATUS_TUNNEL_CHANNEL = 'account:status' as const

export type AccountSuspendNotification = {
  type: 'account-suspend-notification'
  accountStatus: 'SUSPENDED'
  reason: string
  redirectTo: string
  at: string
  fraudScore?: number
}

export type AccountReactivateNotification = {
  type: 'account-reactivate-notification'
  accountStatus: 'ACTIVE'
  at: string
}

export type AccountStatusTunnelPayload =
  | AccountSuspendNotification
  | AccountReactivateNotification
