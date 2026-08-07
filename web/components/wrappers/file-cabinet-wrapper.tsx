'use client'

/**
 * File Cabinet — three-column shell (RingRightRailLayout + DavinciCenterPane)
 * lives inside FileCabinetDesktop (title / tree / info in right rail; workspace center).
 * Page-level wrapper mirrors WalletWrapper: thin client boundary for Suspense pages.
 */
import { FileCabinetDesktop } from '@/features/file-cabinet/components/file-cabinet-desktop'
import type { FileCabinetDesktopScope } from '@/features/file-cabinet/types'

interface FileCabinetWrapperProps {
  scope?: FileCabinetDesktopScope
  className?: string
}

export default function FileCabinetWrapper({
  scope = 'own',
  className,
}: FileCabinetWrapperProps) {
  return <FileCabinetDesktop scope={scope} className={className} />
}
