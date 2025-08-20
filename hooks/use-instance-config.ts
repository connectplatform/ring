'use client'
import { useContext } from 'react'
import { InstanceConfigContext, PublicInstanceConfig } from '@/components/common/whitelabel/instance-config-client'

export function useInstanceConfig(): PublicInstanceConfig {
  const ctx = useContext(InstanceConfigContext)
  if (!ctx) throw new Error('useInstanceConfig must be used within InstanceConfigProvider')
  return ctx
}
