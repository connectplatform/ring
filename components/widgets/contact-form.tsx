'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitContactForm, ContactFormState } from '@/app/actions/contact'
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Typography } from "@/components/ui/typography"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ContactFormProps {
  entityId: string
  entityName: string
  initialUserInfo: {
    name: string
    email: string
  }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending...' : 'Send'}
    </Button>
  )
}

export function ContactForm({ entityId, entityName, initialUserInfo }: ContactFormProps) {
  const [state, formAction] = useActionState<ContactFormState | null, FormData>(
    submitContactForm,
    null
  )

  // Show success message
  if (state?.success) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <AlertDescription className="text-center text-xl">
          {state.message}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields for entity info */}
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="entityName" value={entityName} />

      {/* Show error message if any */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {!initialUserInfo.name && (
        <div>
          <Label htmlFor="name" className="block mb-1">Name</Label>
          <Input
            id="name"
            name="name"
            required
          />
        </div>
      )}

      {initialUserInfo.name && (
        <input type="hidden" name="name" value={initialUserInfo.name} />
      )}

      {!initialUserInfo.email && (
        <div>
          <Label htmlFor="email" className="block mb-1">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
          />
        </div>
      )}

      {initialUserInfo.email && (
        <input type="hidden" name="email" value={initialUserInfo.email} />
      )}

      <div>
        <Label htmlFor="message" className="block mb-1">Message</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          required
        />
      </div>

      <SubmitButton />
    </form>
  )
} 