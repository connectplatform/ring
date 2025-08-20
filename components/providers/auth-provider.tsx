'use client'

import { SessionProvider } from '@/components/providers/session-provider'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}