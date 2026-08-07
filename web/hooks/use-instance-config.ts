'use client'
import { use } from 'react'
import { InstanceConfigContext, PublicInstanceConfig } from '@/components/common/whitelabel/instance-config-client'

/**
 * Modern React 19 hook to access instance configuration
 * Uses the use() hook for better performance and conditional access
 */
export function useInstanceConfig(): PublicInstanceConfig {
  const ctx = use(InstanceConfigContext)
  if (!ctx) throw new Error('useInstanceConfig must be used within InstanceConfigProvider')
  return ctx
}
