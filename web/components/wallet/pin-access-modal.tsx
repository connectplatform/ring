'use client'

/** @deprecated PIN flow removed — pass-through wrapper for legacy imports */
export function PinAccessModal({
  children,
}: {
  onPinVerified?: (walletAddress: string, accessToken: string) => void
  children: React.ReactNode
}) {
  return <>{children}</>
}
