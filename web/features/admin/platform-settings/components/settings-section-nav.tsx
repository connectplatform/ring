'use client'

import type React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlatformSettingsSection = 'ai' | 'branding'

type SectionItem = {
  id: PlatformSettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type SettingsSectionNavProps = {
  items: SectionItem[]
  activeSection: PlatformSettingsSection
  onSelect: (section: PlatformSettingsSection) => void
  title: string
}

export function SettingsSectionNav({
  items,
  activeSection,
  onSelect,
  title,
}: SettingsSectionNavProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <Button
              key={item.id}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              className={cn('w-full justify-start', isActive && 'shadow-sm')}
              onClick={() => onSelect(item.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}

export const DEFAULT_SECTION_ICONS = {
  ai: Brain,
  branding: Palette,
} as const
