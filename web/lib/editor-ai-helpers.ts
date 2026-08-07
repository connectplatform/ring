'use client'

import { useTranslations } from 'next-intl'

/** Keyword-based stub responses for the AI research sidebar (copy from editor.json). */
export function usePickAiResearchResponse() {
  const t = useTranslations('editor.aiAssistant.responses')

  return (lowerInput: string): string => {
    const isAbstract =
      lowerInput.includes('abstract') ||
      lowerInput.includes('анотац') ||
      lowerInput.includes('аннотац')
    const isMethodology =
      lowerInput.includes('methodolog') || lowerInput.includes('методолог')

    if (isAbstract) return t('abstract')
    if (isMethodology) return t('methodology')
    return t('default')
  }
}
