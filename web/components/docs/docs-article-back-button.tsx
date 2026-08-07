'use client'

import { useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DocsArticleBackButtonProps = {
  label: string
}

/** Browser-history back — not parent docs slug navigation. */
export function DocsArticleBackButton({ label }: DocsArticleBackButtonProps) {
  const router = useRouter()

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/docs')
  }, [router])

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="shrink-0 gap-2 px-2"
      onClick={handleBack}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  )
}
