'use client'

import { Sparkles } from 'lucide-react'
import { ProfileTagCloud } from '@/components/profile/profile-tag-cloud'
import { KNOWN_SKILL_TAGS } from '@/features/auth/lib/skill-tags'

type SkillsTagCloudProps = {
  value?: string | string[] | null
  onSaved?: (skills: string[]) => void
  className?: string
}

/** Profile Skills & Expertise — tag-cloud + FsModal. */
export function SkillsTagCloud({ value, onSaved, className }: SkillsTagCloudProps) {
  return (
    <ProfileTagCloud
      field="skills"
      value={value}
      knownTags={KNOWN_SKILL_TAGS}
      className={className}
      icon={Sparkles}
      notSetKey="skillsNotSet"
      addKey="addSkillTag"
      selectTitleKey="selectSkillTitle"
      searchPlaceholderKey="skillSearchPlaceholder"
      searchIdleKey="skillSearchIdle"
      removeKey="removeSkillTag"
      saveFailedKey="skillsSaveFailed"
      onSaved={(next) =>
        onSaved?.(Array.isArray(next) ? next : next.split(',').map((s) => s.trim()).filter(Boolean))
      }
    />
  )
}
