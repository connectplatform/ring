'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * Simple wrapper hook around React 19 useActionState for forms.
 */
export function useFormAction<S, A extends (prev: S | null, formData: FormData) => Promise<S>>(action: A) {
  const [state, formAction] = useActionState<S | null, FormData>(action as any, null)
  const { pending } = useFormStatus()
  return { state, formAction, pending }
}


