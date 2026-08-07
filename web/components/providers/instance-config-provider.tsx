import React from 'react'
import { getPublicInstanceConfig } from '@/lib/ring-config-core'
import { InstanceConfigClientProvider } from '@/components/common/whitelabel/instance-config-client'

/** Server-only provider for nested layouts that need instance config outside AppClientShell. */
export default function InstanceConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <InstanceConfigClientProvider value={getPublicInstanceConfig()}>
      {children}
    </InstanceConfigClientProvider>
  )
}
