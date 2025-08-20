import React from 'react'
import { getInstanceConfig } from '@/lib/instance-config'
import { InstanceConfigClientProvider, PublicInstanceConfig } from '@/components/common/whitelabel/instance-config-client'

export default function InstanceConfigProvider({ children }: { children: React.ReactNode }) {
  const cfg = getInstanceConfig()
  const publicCfg: PublicInstanceConfig = {
    name: cfg.name,
    brand: {
      colors: cfg.brand.colors,
      logoUrl: cfg.brand.logoUrl,
      faviconUrl: cfg.brand.faviconUrl,
      ogImageUrl: cfg.brand.ogImageUrl,
    },
    seo: cfg.seo,
    navigation: cfg.navigation,
    hero: cfg.hero,
    features: cfg.features,
  }
  return <InstanceConfigClientProvider value={publicCfg}>{children}</InstanceConfigClientProvider>
}
