'use client'

import { useFormStatus } from 'react-dom'

export function useFormPending() {
  const { pending } = useFormStatus()
  return pending
}


