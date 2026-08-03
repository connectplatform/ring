'use client'

import { LocaleCodeMenu } from '@/components/common/locale-code-menu'

/** Locale droplist (Globe + native names) — shared with docs right-rail via LocaleCodeMenu. */
export function LanguageSwitcher() {
  return <LocaleCodeMenu variant="docs" />
}

export default LanguageSwitcher
