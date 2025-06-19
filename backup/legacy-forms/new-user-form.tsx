'use client'

import React, { useState } from 'react'
import { useForm, FieldValues } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FirebaseService from '@/lib/firebase-service'

/**
 * Props for the new-user-form component
 * @interface new-user-formProps
 * @property {string} userId - The ID of the user
 * @property {() => void} onComplete - Callback function to be called when the form submission is complete
 */
interface NewUserFormProps {
  userId: string
  onCompleteAction: () => Promise<void>
}

/**
 * new-user-form component
 * This component renders a form for new users to complete their profile information
 * 
 * User steps:
 * 1. User sees a welcome message and a form with name and email fields
 * 2. User can choose to link their Google account
 * 3. User fills out the form fields
 * 4. User submits the form
 * 5. On successful submission, the onComplete callback is called
 * 
 * @param {new-user-formProps} props - The component props
 * @returns {JSX.Element} The rendered new-user-form component
 */
export default function NewUserForm({ userId, onCompleteAction }: NewUserFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FieldValues>()
  const [isLinking, setIsLinking] = useState(false)

  /**
   * Handles the form submission
   * @param {FieldValues} data - The form data
   */
  const onSubmit = async (data: FieldValues) => {
    try {
      await FirebaseService.createOrUpdateUserProfile({
        id: userId,
        ...data
      })
      await onCompleteAction()
    } catch (error) {
      console.error('Error updating user profile:', error)
    }
  }

  /**
   * Handles linking the user's Google account
   */
  const handleGoogleLink = async () => {
    setIsLinking(true)
    try {
      await FirebaseService.linkGoogleAccount(userId)
      await onCompleteAction()
    } catch (error) {
      console.error('Error linking Google account:', error)
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Welcome, New user! Please tell us about you</h2>
      <Button onClick={handleGoogleLink} disabled={isLinking} className="mb-4">
        {isLinking ? 'Linking...' : 'Link Google Account'}
      </Button>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name', { required: 'Name is required' })} />
          {errors.name && <p className="text-red-500">{errors.name.message as string}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email', { required: 'Email is required' })} />
          {errors.email && <p className="text-red-500">{errors.email.message as string}</p>}
        </div>
        <Button type="submit">Save Profile</Button>
      </form>
    </div>
  )
}

