'use client'

import React from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitButton({ children, className }: { children: React.ReactNode, className?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className={className}>
      {children}
    </Button>
  )
}


