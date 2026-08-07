'use client'

import { Briefcase } from 'lucide-react'
import { ProfileTagCloud } from '@/components/profile/profile-tag-cloud'
import { KNOWN_POSITION_TAGS } from '@/features/auth/lib/position-tags'

type PositionTagCloudProps = {
  value?: string | string[] | null
  onSaved?: (position: string) => void
  className?: string
}

/** Profile Position — thin wrapper over ProfileTagCloud. */
export function PositionTagCloud({ value, onSaved, className }: PositionTagCloudProps) {
  return (
    <ProfileTagCloud
      field="position"
      value={value}
      knownTags={KNOWN_POSITION_TAGS}
      className={className}
      icon={Briefcase}
      notSetKey="positionNotSet"
      addKey="addPositionTag"
      selectTitleKey="selectPositionTitle"
      searchPlaceholderKey="positionSearchPlaceholder"
      searchIdleKey="positionSearchIdle"
      removeKey="removePositionTag"
      saveFailedKey="positionSaveFailed"
      onSaved={(next) => onSaved?.(typeof next === 'string' ? next : next.join(', '))}
    />
  )
}
