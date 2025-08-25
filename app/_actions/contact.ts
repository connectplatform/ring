'use server'

import { sendToTelegramBot } from '@/lib/telegram'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export interface ContactFormState {
  success?: boolean
  message?: string
  error?: string
}

export async function submitContactForm(
  prevState: ContactFormState | null,
  formData: FormData
): Promise<ContactFormState> {
  // Optional: Get session to track logged-in users
  const session = await auth()
  
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
    // Include user info if logged in
    await sendToTelegramBot({
      entityId,
      entityName,
      name: session?.user?.name || name,
      email: session?.user?.email || email,
      message,
      userId: session?.user?.id // Track if from logged-in user
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