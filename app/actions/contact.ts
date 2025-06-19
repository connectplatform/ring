'use server'

import { sendToTelegramBot } from '@/lib/telegram'
import { redirect } from 'next/navigation'

export interface ContactFormState {
  success?: boolean
  message?: string
  error?: string
}

export async function submitContactForm(
  prevState: ContactFormState | null,
  formData: FormData
): Promise<ContactFormState> {
  const entityId = formData.get('entityId') as string
  const entityName = formData.get('entityName') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  // Validation
  if (!name || !email || !message) {
    return {
      error: 'All fields are required'
    }
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return {
      error: 'Please enter a valid email address'
    }
  }

  try {
    await sendToTelegramBot({
      entityId,
      entityName,
      name,
      email,
      message
    })

    return {
      success: true,
      message: 'Thank you for your message. We\'ll get back to you soon!'
    }
  } catch (error) {
    console.error('Error sending contact form:', error)
    return {
      error: 'Failed to send message. Please try again.'
    }
  }
} 